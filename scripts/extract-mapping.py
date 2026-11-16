#!/usr/bin/env python3
"""Generate src/lib/db-types.ts (and scripts/codemod-mapping.md) from the DDL.

The application runtime uses the Supabase JS client against the production
DDL in sql/ — this script keeps the TypeScript row types in sync with that
DDL. Interface order is preserved from the existing db-types.ts headers, so
re-running produces a stable diff; new DDL columns flow into the types.

Conventions (matching the converted codebase):
  - <Model>Row interfaces: snake_case columns exactly as PostgREST returns.
  - <Model> aliases: CamelizeRow<> camelCase views for application code.
  - Enum domains (portal.*) map to string; jsonb to Json; inet to string.
  - All fields are declared required (the conversion layer assumes strings
    for timestamps and handles nulls at the query level).
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
TYPES_OUT = ROOT / "src" / "lib" / "db-types.ts"
MAPPING_OUT = ROOT / "scripts" / "codemod-mapping.md"

# Model name -> table (order follows the historical Prisma schema; stable).
MODEL_TABLES: list[tuple[str, str]] = [
    ("User", "users"),
    ("Session", "sessions"),
    ("AuthToken", "auth_tokens"),
    ("SecurityEvent", "security_events"),
    ("Organisation", "organisations"),
    ("OrganisationMember", "organisation_members"),
    ("InvestorProfile", "investor_profiles"),
    ("InvestorCriteria", "investor_criteria"),
    ("SavedOpportunity", "saved_opportunities"),
    ("OpportunityView", "opportunity_views"),
    ("SavedSearch", "saved_searches"),
    ("Scenario", "scenarios"),
    ("Comparison", "comparisons"),
    ("Order", "orders"),
    ("Payment", "payments"),
    ("Mandate", "mandates"),
    ("MandateMilestone", "mandate_milestones"),
    ("Enquiry", "enquiries"),
    ("Message", "messages"),
    ("Notification", "notifications"),
    ("NotificationSetting", "notification_settings"),
    ("NotificationPreference", "notification_preferences"),
    ("PushSubscription", "push_subscriptions"),
    ("NotificationDelivery", "notification_deliveries"),
    ("EmailTemplate", "email_templates"),
    ("EmailTemplateVersion", "email_template_versions"),
    ("NotificationAnnouncement", "notification_announcements"),
    ("DocumentGrant", "document_grants"),
    ("DocumentAccessLog", "document_access_logs"),
    ("DocumentRequest", "document_requests"),
    ("NdaAgreement", "nda_agreements"),
    ("PortfolioPosition", "portfolio_positions"),
    ("CapitalCall", "capital_calls"),
    ("StaffProfile", "staff_profiles"),
    ("OrderStatusEvent", "order_status_events"),
    ("RevenueEvent", "revenue_events"),
    ("RefundAdjustment", "refund_adjustments"),
    ("ComplianceReview", "compliance_reviews"),
    ("InternalNote", "internal_notes"),
    ("ContentMeta", "content_meta"),      # singular in DDL
    ("SystemSetting", "system_settings"),
    ("AuditLog", "logs"),                 # lives in the `audit` schema
]

KNOWN_TYPES = {"text", "timestamptz", "timestamp", "integer", "int", "int4", "smallint",
               "int2", "bigint", "boolean", "bool", "numeric", "decimal", "real", "double",
               "double precision", "json", "jsonb", "inet", "uuid", "varchar", "citext",
               "date", "time", "interval", "array"}

TS_TYPES = {
    "text": "string", "uuid": "string", "varchar": "string", "citext": "string",
    "timestamptz": "string", "timestamp": "string", "date": "string", "time": "string",
    "boolean": "boolean", "bool": "boolean", "inet": "string",
    "integer": "number", "int": "number", "int4": "number", "smallint": "number",
    "int2": "number", "bigint": "number", "numeric": "number", "decimal": "number",
    "real": "number", "double": "number", "json": "Json", "jsonb": "Json",
}


def parse_columns(body: str) -> list[tuple[str, str, str]]:
    cols = []
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
            continue  # constraint continuation line, not a column
        if col.upper() in ("PRIMARY", "FOREIGN", "CONSTRAINT", "UNIQUE", "CHECK"):
            continue
        dm = re.search(r"DEFAULT\s+([^\s,]+)", line, re.I)
        cols.append((col, coltype, dm.group(1) if dm else ""))
    return cols


# ---------------- parse SQL ----------------
tables: dict[str, list[tuple[str, str, str]]] = {}
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
        tables.setdefault(tname, []).extend(parse_columns(src[start:i - 1]))
    for m in re.finditer(r"ALTER\s+TABLE\s+(?:IF\s+EXISTS\s+)?[\"']?([\w.]+)[\"']?\s+(.*?);", src, re.I | re.S):
        tname = m.group(1).split(".")[-1]
        for am in re.finditer(r"ADD\s+COLUMN\s+(?:IF\s+NOT\s+EXISTS\s+)?[\"']?(\w+)[\"']?\s+([A-Za-z][\w.]*[^,]*)", m.group(2), re.I):
            col, rest = am.group(1), am.group(2)
            dm = re.search(r"DEFAULT\s+([^\s,]+)", rest, re.I)
            ctype = re.match(r"([A-Za-z][\w.]*(?:\s*\([^)]*\))?)", rest).group(1)
            tables.setdefault(tname, []).append((col, ctype, dm.group(1) if dm else ""))

# ---------------- emit ----------------
problems = []
for model, t in MODEL_TABLES:
    if t not in tables:
        problems.append(f"MODEL {model}: table '{t}' NOT FOUND in DDL")

ts = [
    "// ============================================================================",
    "// Murivest Private Capital Portal — DB row types",
    "// Auto-derived from sql/001_schema.sql · 004_admin_schema.sql ·",
    "// 006_notifications_schema.sql (production DDL on Supabase, `portal` schema).",
    "// Row shape as returned by the Supabase JS client (snake_case).",
    "// Use toCamel() from '@/lib/supabase' to work in camelCase in app code.",
    "//",
    "// Two exports per model: <Model>Row (snake_case, DB shape) and <Model>",
    "// (camelCase view). Regenerate: python3 scripts/extract-mapping.py",
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
doc = [
    "# Table reference — Supabase DDL (sql/), as used by src/lib/supabase.ts",
    "",
    "All tables live in the `portal` schema; audit rows in `audit` (audit.logs).",
    "The client is created with `db: {schema: 'portal'}`; audit writes go through `auditTable()`.",
    "",
]

for model, t in MODEL_TABLES:
    if t not in tables:
        continue
    ts.append(f"/** {model} — table `{t}` */")
    ts.append(f"export interface {model}Row {{")
    doc.append(f"## {model}  ->  `{t}`")
    doc.append("| column | SQL type | default |")
    doc.append("| --- | --- | --- |")
    for col, coltype, default in tables[t]:
        base = coltype.split("(")[0].strip().lower()
        ts_type = "string" if "." in base else TS_TYPES.get(base, "unknown")
        ts.append(f"  {col}: {ts_type}")
        doc.append(f"| {col} | {coltype} | {default or '—'} |")
    ts.append("}")
    ts.append(f"export type {model} = CamelizeRow<{model}Row>")
    ts.append("")
    doc.append("")

if problems:
    print("PROBLEMS:")
    for p in problems:
        print("  " + p)
    sys.exit(1)

TYPES_OUT.write_text("\n".join(ts))
MAPPING_OUT.write_text("\n".join(doc))
print(f"OK: {len(MODEL_TABLES)} models -> {TYPES_OUT.relative_to(ROOT)} ({len(ts)} lines) + {MAPPING_OUT.relative_to(ROOT)}")
