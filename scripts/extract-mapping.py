#!/usr/bin/env python3
"""Extract model->table / field->column mapping for the Prisma->Supabase codemod.

Parses prisma/schema.prisma (models/fields/@map/@@map) and sql/00*.sql
(CREATE TABLE + ALTER TABLE ADD COLUMN). Cross-validates naming and emits:
  - scripts/codemod-mapping.md   (human/subagent reference, incl. rpc functions)
  - src/lib/db-types.ts          (TS row interfaces, snake_case)
Exit code 1 if any model or scalar field cannot be mapped.
"""
import re
import sys
import pathlib

ROOT = pathlib.Path("/home/z/my-project")
PRISMA = ROOT / "prisma" / "schema.prisma"
SQL_FILES = [
    ROOT / "sql" / "001_schema.sql",
    ROOT / "sql" / "004_admin_schema.sql",
    ROOT / "sql" / "006_notifications_schema.sql",
]
FUNCS_FILE = ROOT / "sql" / "003_functions.sql"

def snake(name: str) -> str:
    s = re.sub(r"(?<=[a-z0-9])([A-Z])", r"_\1", name)
    s = re.sub(r"(?<=[A-Z])([A-Z][a-z])", r"_\1", s)
    return s.lower()

def plural(name: str) -> str:
    if name.endswith("criteria"):
        return name
    if re.search(r"[^aeiou]y$", name):
        return name[:-1] + "ies"
    if re.search(r"(s|x|z|ch|sh)$", name):
        return name + "es"
    return name + "s"

TABLE_OVERRIDES = {
    "ContentMeta": "content_meta",  # singular in DDL
    "AuditLog": "logs",             # lives in the `audit` schema -> .from('audit.logs')
}

# ---------------- parse prisma ----------------
prisma_src = PRISMA.read_text()
models = {}  # name -> {fields: [(name, type, mapped)], table: str}
model_re = re.compile(r"^model\s+(\w+)\s*\{", re.M)
for m in model_re.finditer(prisma_src):
    name = m.group(1)
    body_start = m.end()
    depth = 1
    i = body_start
    while i < len(prisma_src) and depth > 0:
        if prisma_src[i] == "{":
            depth += 1
        elif prisma_src[i] == "}":
            depth -= 1
        i += 1
    body = prisma_src[body_start : i - 1]
    fields = []
    table_map = None
    for line in body.splitlines():
        line = line.strip()
        if not line or line.startswith("//"):
            continue
        mm = re.match(r"@@map\(\s*[\"']([^\"']+)[\"']\s*\)", line)
        if mm:
            table_map = mm.group(1)
            continue
        if line.startswith("@@"):
            continue
        fm = re.match(r"(\w+)\s+([\w\[\]?]+)", line)
        if not fm:
            continue
        fname, ftype = fm.group(1), fm.group(2)
        fmap = None
        fm2 = re.search(r"@map\(\s*[\"']([^\"']+)[\"']\s*\)", line)
        if fm2:
            fmap = fm2.group(1)
        fields.append((fname, ftype, fmap))
    models[name] = {"fields": fields, "table": table_map or TABLE_OVERRIDES.get(name) or plural(snake(name))}

model_names = set(models)

# ---------------- parse sql ----------------
tables = {}  # name -> [(col, coltype, default)]

KNOWN_TYPES = {"text", "timestamptz", "timestamp", "integer", "int", "int4", "smallint",
                   "int2", "bigint", "boolean", "bool", "numeric", "decimal", "real", "double",
                   "double precision", "json", "jsonb", "inet", "uuid", "varchar", "citext",
                   "date", "time", "interval", "array"}

def parse_column_lines(body: str) -> list:
    cols = []
    for raw_line in body.splitlines():
        line = raw_line.strip()
        if not line or line.startswith("--"):
            continue
        if re.match(r"^(PRIMARY\s+KEY|FOREIGN\s+KEY|CONSTRAINT|UNIQUE|CHECK|EXCLUDE)\b", line, re.I):
            continue
        cm = re.match(r"[\"']?(\w+)[\"']?\s+([A-Za-z][\w.]*(?:\s*\([^)]*\))?)", line)
        if not cm:
            continue
        col = cm.group(1)
        coltype = cm.group(2)
        base = coltype.split("(")[0].strip().lower()
        if not (base in KNOWN_TYPES or base.startswith("portal.") or base.startswith("audit.")):
            continue  # constraint continuation line (e.g. "x IS NULL OR ..."), not a column
        if col.upper() in ("PRIMARY", "FOREIGN", "CONSTRAINT", "UNIQUE", "CHECK"):
            continue
        default = ""
        dm = re.search(r"DEFAULT\s+([^\s,]+)", line, re.I)
        if dm:
            default = dm.group(1)
        cols.append((col, coltype, default))
    return cols

for sf in SQL_FILES:
    src = sf.read_text()
    for m in re.finditer(r"CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?[\"']?([\w.]+)[\"']?\s*\(", src, re.I):
        tname = m.group(1).split(".")[-1]
        start = m.end()
        depth = 1
        i = start
        while i < len(src) and depth > 0:
            if src[i] == "(":
                depth += 1
            elif src[i] == ")":
                depth -= 1
            i += 1
        body = src[start : i - 1]
        tables[tname] = parse_column_lines(body)
    # ALTER TABLE <name> ADD COLUMN ... (multi-clause, until ;)
    for m in re.finditer(r"ALTER\s+TABLE\s+(?:IF\s+EXISTS\s+)?[\"']?([\w.]+)[\"']?\s+(.*?);", src, re.I | re.S):
        tname = m.group(1).split(".")[-1]
        stmt = m.group(2)
        for am in re.finditer(r"ADD\s+COLUMN\s+(?:IF\s+NOT\s+EXISTS\s+)?[\"']?(\w+)[\"']?\s+([A-Za-z][\w.]*[^,]*)", stmt, re.I):
            col, rest = am.group(1), am.group(2)
            dm = re.search(r"DEFAULT\s+([^\s,]+)", rest, re.I)
            default = dm.group(1) if dm else ""
            ctype = re.match(r"([A-Za-z][\w.]*(?:\s*\([^)]*\))?)", rest).group(1)
            tables.setdefault(tname, []).append((col, ctype, default))

# ---------------- cross-validate ----------------
problems = []
mapping = []  # (model, table, [(prisma_field, column, coltype, default)])

for model, info in models.items():
    t = info["table"]
    if t not in tables:
        problems.append(f"MODEL {model}: table '{t}' NOT FOUND in sql DDL")
        mapping.append((model, t, []))
        continue
    cols = {c[0]: c for c in tables[t]}
    field_rows = []
    for fname, ftype, fmap in info["fields"]:
        base_type = ftype.strip("?[]")
        if base_type in model_names:  # relation field -> not a column
            continue
        col = fmap or snake(fname)
        if col not in cols:
            problems.append(f"MODEL {model}.{fname}: column '{col}' NOT FOUND in {t}")
            continue
        _, coltype, default = cols[col]
        field_rows.append((fname, col, coltype, default))
    mapping.append((model, t, field_rows))

# tables in SQL that no Prisma model covers (informational)
uncovered = sorted(set(tables) - {info["table"] for info in models.values()})

# ---------------- emit mapping doc ----------------
funcs = []
if FUNCS_FILE.exists():
    fsrc = FUNCS_FILE.read_text()
    funcs = re.findall(r"CREATE\s+(?:OR\s+REPLACE\s+)?FUNCTION\s+([\w.]+)\s*\(", fsrc, re.I)
    funcs = [f.split(".")[-1] for f in funcs]

out = ["# Codemod mapping — Prisma model -> Supabase table (sql/ DDL, snake_case)", "",
       "All tables live in the `portal` schema (schema-qualified DDL).",
       "Supabase client is created with `db: {schema: 'portal'}` — see src/lib/supabase.ts.",
       "Postgres functions callable via `.rpc()` from sql/003_functions.sql: " + (", ".join(funcs) if funcs else "(none)") + ".",
       ""]
for model, t, field_rows in mapping:
    out.append(f"## {model}  ->  `{t}`")
    out.append("| Prisma field | DB column | SQL type | default |")
    out.append("| --- | --- | --- | --- |")
    for fname, col, coltype, default in field_rows:
        out.append(f"| {fname} | {col} | {coltype} | {default or '—'} |")
    out.append("")
if uncovered:
    out.append("## SQL tables with no Prisma model (informational)")
    out.append(", ".join(uncovered))
    out.append("")
if problems:
    out.append("## PROBLEMS (must resolve manually)")
    out.extend(f"- {p}" for p in problems)
(ROOT / "scripts" / "codemod-mapping.md").write_text("\n".join(out))

# ---------------- emit db-types.ts ----------------
TS_TYPES = {
    "text": "string", "uuid": "string", "varchar": "string", "citext": "string",
    "timestamptz": "string", "timestamp": "string", "date": "string", "time": "string",
    "boolean": "boolean", "bool": "boolean", "inet": "string",
    "integer": "number", "int": "number", "int4": "number", "smallint": "number",
    "bigint": "number", "numeric": "number", "decimal": "number", "real": "number",
    "double": "number", "json": "Json", "jsonb": "Json",
}
ts = [
    "// ============================================================================",
    "// Murivest Private Capital Portal — DB row types",
    "// Auto-derived from sql/001_schema.sql · 004_admin_schema.sql ·",
    "// 006_notifications_schema.sql (production DDL on Supabase, `portal` schema).",
    "// Row shape as returned by the Supabase JS client (snake_case).",
    "// Use toCamel() from '@/lib/supabase' to work in camelCase in app code.",
    "//",
    "// Two exports per model: <Model>Row (snake_case, DB shape) and <Model>",
    "// (camelCase view, replaces the former @prisma/client model types).",
    "// ============================================================================",
    "",
    "export type Json = string | number | boolean | null | Json[] | { [k: string]: Json }",
    "",
    "type SnakeToCamel<S extends string> = S extends `${infer Head}_${infer Rest}`",
    "  ? `${Head}${SnakeToCamel<Capitalize<Rest>>}`",
    "  : S",
    "",
    "/** camelCase view of a snake_case DB row (same value types, renamed keys). */",
    "export type CamelizeRow<T> = {",
    "  [K in keyof T as SnakeToCamel<K & string>]: T[K]",
    "}",
    "",
]
for model, t, field_rows in mapping:
    if not field_rows:
        continue
    ts.append(f"/** {model} — table `{t}` */")
    ts.append(f"export interface {model}Row {{")
    for fname, col, coltype, default in field_rows:
        base = coltype.split("(")[0].strip().lower()
        # enum types like portal.user_role -> string
        ts_type = "string" if "." in base else TS_TYPES.get(base, "unknown")
        ts.append(f"  {col}: {ts_type}")
    ts.append("}")
    ts.append(f"export type {model} = CamelizeRow<{model}Row>")
    ts.append("")
(ROOT / "src" / "lib" / "db-types.ts").write_text("\n".join(ts))

print(f"models: {len(models)}, tables parsed: {len(tables)}, mapped: {sum(1 for _,_,f in mapping if f)}")
if uncovered:
    print("uncovered SQL tables:", ", ".join(uncovered))
if problems:
    print("PROBLEMS:")
    for p in problems:
        print("  " + p)
    sys.exit(1)
print("mapping OK -> scripts/codemod-mapping.md, src/lib/db-types.ts")
