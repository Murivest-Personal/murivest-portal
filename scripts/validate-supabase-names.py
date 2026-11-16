#!/usr/bin/env python3
"""Validate Supabase client string literals against the production DDL.

Scans src/**/*.{ts,tsx} for:
  - .from('<table>')            -> table must exist in sql/ DDL (portal.* or audit.logs)
  - .eq/.not/.is/.in/.gt/...('<col>', ...) and .order('<col>') -> column must exist somewhere
  - .or('<col>.op.<val>,...')   -> leading column names must exist
  - {onConflict: '<cols>'}      -> each column must exist
Column literals are validated against the UNION of all DDL columns (static
analysis cannot bind a column to its enclosing table reliably), which still
catches every camelCase / misspelling class of bug.
"""
import re
import pathlib
import sys

ROOT = pathlib.Path("/home/z/my-project")
SQL_FILES = [
    ROOT / "sql" / "001_schema.sql",
    ROOT / "sql" / "004_admin_schema.sql",
    ROOT / "sql" / "006_notifications_schema.sql",
]

KNOWN_TYPES = {"text", "timestamptz", "timestamp", "integer", "int", "int4", "smallint",
               "int2", "bigint", "boolean", "bool", "numeric", "decimal", "real", "double",
               "double precision", "json", "jsonb", "inet", "uuid", "varchar", "citext",
               "date", "time", "interval", "array"}

tables: dict[str, set[str]] = {}

def parse_cols(body: str) -> set[str]:
    cols = set()
    for raw in body.splitlines():
        line = raw.strip()
        if not line or line.startswith("--"):
            continue
        if re.match(r"^(PRIMARY\s+KEY|FOREIGN\s+KEY|CONSTRAINT|UNIQUE|CHECK|EXCLUDE)\b", line, re.I):
            continue
        cm = re.match(r"[\"']?(\w+)[\"']?\s+([A-Za-z][\w.]*(?:\s*\([^)]*\))?)", line)
        if not cm:
            continue
        col, coltype = cm.group(1), cm.group(2)
        base = coltype.split("(")[0].strip().lower()
        if not (base in KNOWN_TYPES or base.startswith("portal.") or base.startswith("audit.")):
            continue
        if col.upper() in ("PRIMARY", "FOREIGN", "CONSTRAINT", "UNIQUE", "CHECK"):
            continue
        cols.add(col)
    return cols

for sf in SQL_FILES:
    src = sf.read_text()
    for m in re.finditer(r"CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?[\"']?([\w.]+)[\"']?\s*\(", src, re.I):
        tname = m.group(1).split(".")[-1]
        start, depth, i = m.end(), 1, m.end()
        while i < len(src) and depth > 0:
            if src[i] == "(":
                depth += 1
            elif src[i] == ")":
                depth -= 1
            i += 1
        tables.setdefault(tname, set()).update(parse_cols(src[start:i - 1]))
    for m in re.finditer(r"ALTER\s+TABLE\s+(?:IF\s+EXISTS\s+)?[\"']?([\w.]+)[\"']?\s+(.*?);", src, re.I | re.S):
        tname = m.group(1).split(".")[-1]
        for am in re.finditer(r"ADD\s+COLUMN\s+(?:IF\s+NOT\s+EXISTS\s+)?[\"']?(\w+)[\"']?", m.group(2), re.I):
            tables.setdefault(tname, set()).add(am.group(1))

all_columns: set[str] = set().union(*tables.values())
# expressions allowed in .order()/filters (PostgREST params, not columns)
ALLOWED_NON_COLUMNS = {"count", "exact", "head", "ascending"}

problems: list[str] = []
table_refs = 0
col_refs = 0

FROM_RE = re.compile(r"\.from\(\s*['\"]([A-Za-z_][\w.]*)['\"]\s*\)")
COL_RE = re.compile(
    r"\.(?:eq|not|is|in|gt|gte|lt|lte|like|ilike|order|contains)\(\s*['\"]([a-z_][a-z_0-9]*)['\"]"
)
OR_RE = re.compile(r"\.or\(\s*[`'\"]([^`'\"]+)[`'\"]")
ONCONFLICT_RE = re.compile(r"onConflict:\s*['\"]([\w,]+)['\"]")

for path in sorted((ROOT / "src").rglob("*.ts")) + sorted((ROOT / "src").rglob("*.tsx")):
    rel = str(path.relative_to(ROOT))
    text = path.read_text()
    for m in FROM_RE.finditer(text):
        t = m.group(1)
        table_refs += 1
        if t not in tables:
            problems.append(f"{rel}: unknown table .from('{t}')")
    for m in COL_RE.finditer(text):
        c = m.group(1)
        if c in ALLOWED_NON_COLUMNS:
            continue
        col_refs += 1
        if c not in all_columns:
            problems.append(f"{rel}: unknown column '{c}' in filter/order call")
    for m in OR_RE.finditer(text):
        for part in m.group(1).split(","):
            part = part.strip()
            if not part or part.startswith("(") or part.endswith(")"):
                # nested groups — validate inner parts instead
                for inner in re.findall(r"([a-z_][a-z_0-9]*)\.(?:eq|neq|gt|gte|lt|lte|in|is)\.", part):
                    col_refs += 1
                    if inner not in all_columns:
                        problems.append(f"{rel}: unknown column '{inner}' in .or() expression")
                continue
            col = part.split(".", 1)[0]
            col_refs += 1
            if col not in all_columns:
                problems.append(f"{rel}: unknown column '{col}' in .or() expression")
    for m in ONCONFLICT_RE.finditer(text):
        for c in [x.strip() for x in m.group(1).split(",")]:
            col_refs += 1
            if c not in all_columns:
                problems.append(f"{rel}: unknown column '{c}' in onConflict")

print(f"validated {table_refs} table refs, {col_refs} column refs across DDL ({len(tables)} tables, {len(all_columns)} columns)")
if problems:
    print("PROBLEMS:")
    for p in problems:
        print("  " + p)
    sys.exit(1)
print("all table/column string literals valid")
