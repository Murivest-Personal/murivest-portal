# Murivest Private Capital Portal

Institutional & UHNWI investment workspace for **Murivest Group Ltd** — a private capital allocation environment for UHNWIs, family offices and institutional investors across East Africa (Nairobi), the United Kingdom (London) and international markets.

Built as a **clean, purpose-built institutional product**: Next.js 16 (App Router, TypeScript), Tailwind CSS 4, shadcn/ui, **Supabase (PostgreSQL) via the service-role JS client** for all runtime data, **Sanity as the single content source** (properties, briefs, data-room documents, market intelligence), DB-backed sessions with scrypt + TOTP MFA, and **zero sample data** — every surface renders purposeful empty states until real content is published.

---

## Architecture

```
src/
  app/
    page.tsx                 Public landing + SEO/GEO + auth gateway (modal)
    reset-password/          Password reset entry
    portal/                  Authenticated workspace (12 modules)
      page.tsx               Overview — command centre
      onboarding/            Progressive verification wizard (5 steps)
      discover/  + [id]/     Opportunity intelligence (Sanity-driven, tier-gated)
      studio/                Investment Studio (criteria · modelling · capital gap · sensitivity · exit)
      compare/               Side-by-side workspace, saved comparisons
      orders/                Private & institutional briefs + payments + tracking
      portfolio/             My investments: positions, capital calls, exit links
      mandates/              Acquisition mandates + milestones
      documents/             Secure data room (tier + grants + audit + streaming)
      intelligence/ + [id]/  Market intelligence (Sanity-driven)
      activity/              Advisor threads + activity timeline
      profile/              Profile & preferences
      security/             Password, TOTP MFA, sessions, security history
    api/                     Route handlers (auth, orders, payments, scenarios,
                             mandates, documents, staff desk dispatcher…)
  lib/
    supabase.ts             Service-role Supabase client (all runtime DB access)
    db-types.ts             DDL-derived row types (snake_case rows + camelCase views)
    auth/                    scrypt · opaque sessions · TOTP · tokens · guards · audit
    finance/engine.ts        Transparent financial engine (NOI, DSCR, IRR, sensitivities)
    sanity/                 Server-only Sanity client + GROQ + types
    validation.ts           zod schemas mirroring SQL constraints
sql/                        Production PostgreSQL DDL + RLS + functions (below)
sanity-studio/              Standalone Sanity Studio (content schemas)
scripts/create-admin.mjs    First-run administrator bootstrap
```

## The twelve modules

| Module | What it does |
| --- | --- |
| **Overview** | Verification pipeline, access tier, criteria state, recommended opportunities, active orders/mandates, outstanding actions, saved work, quick actions |
| **Discover** | Permission-filtered listings with advanced filters, off-market/auction/high-interest segments, transparent criteria matching, tier-gated financials, save/compare/enquire/model actions |
| **Investment Studio** | Criteria workspace, full financial modelling (NOI, yields, DSCR, cash-on-cash, IRR, equity multiple, payback), capital-gap pathways across LTV points, rate×exit-cap sensitivity grids, year-by-year projections, exit strategy workspace, saved scenarios with export |
| **Compare** | Opportunities × saved scenarios side-by-side; saved comparisons |
| **Orders** | Brief catalogue (Sanity), digital/hard-copy ordering, custom brief scoping requests, M-Pesa / wire / card payment flows, status tracking, receipts, audit trail |
| **My Investments** | Actual positions (deployed capital, financing, income actuals, valuations), capital-call scheduling/tracking, exit planning links |
| **Mandates** | Create/submit/pause/close acquisition mandates, milestones from the desk, Discover tagging of matching opportunities |
| **Documents** | Secure data room: tier + explicit grants, streamed files (asset URLs never exposed), view/download distinction, access logs, requests workflow, NDA gate |
| **Market Intelligence** | Curated research & commentary (Sanity), tier-gated |
| **Activity & Comms** | Advisor threads, enquiries, unified timeline, notification bell |
| **Profile & Preferences** | Investor classification, verification status, capacity, communication preferences |
| **Account & Security** | Password policy, TOTP MFA (QR), device-recognised sessions with revocation, security history |

## Database — Supabase (service-role client)

**All runtime DB access goes through the Supabase JS client** (`src/lib/supabase.ts`) — HTTPS/PostgREST, no Prisma, no direct Postgres connections, no connection-pooler configuration at the application tier:

```ts
import {supabase, unwrap, unwrapNullable, unwrapCount, toCamel, toCamelList, toSnake, nowIso, newId, auditTable} from '@/lib/supabase'

const orders = toCamelList(unwrap<OrderRow[]>(await supabase.from('orders').select('*').eq('user_id', userId), 'orders.list'))
```

Configuration (copy from **Supabase Dashboard → Settings → API**): `NEXT_PUBLIC_SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` (server-side only — never in the browser bundle). The client pins `db.schema = 'portal'`; row types live in `src/lib/db-types.ts` (snake_case rows + camelCase views), generated from the DDL by `scripts/extract-mapping.py`.

**Provisioning** — the schema is plain PostgreSQL DDL, applied once via the Supabase SQL Editor or `psql` (session pooler `:5432` or direct host — the direct `db.<ref>.supabase.co` host is IPv6-only without the IPv4 add-on):

```bash
psql "$DIRECT_URL" -f sql/001_schema.sql    # 27 tables + enums + triggers + audit capture
psql "$DIRECT_URL" -f sql/002_rls.sql       # Row Level Security (investor isolation, advisor/admin roles)
psql "$DIRECT_URL" -f sql/003_functions.sql # create_admin, purge_expired, most-viewed rollups
psql "$DIRECT_URL" -f sql/004_admin_schema.sql # Admin Internal System tables + order/mandate columns
psql "$DIRECT_URL" -f sql/005_admin_rls.sql    # Admin RBAC at the database level
psql "$DIRECT_URL" -f sql/006_notifications_schema.sql # Notifications (deliveries, prefs, push, templates)
```

Then in **Supabase Dashboard → Settings → API → Exposed schemas** add `portal` and `audit` (keep `public`) so the PostgREST endpoint serves them. Ids are TEXT, generated application-side (`newId()`); `updated_at` is trigger-maintained.

Admin system tables (`sql/004_admin_schema.sql`): `staff_profiles` (granular RBAC roles) · `order_status_events` (lifecycle history) · `revenue_events` (recognition ledger — one per order) · `refund_adjustments` (controlled refunds) · `compliance_reviews` (KYC/AML decisions with before/after snapshots) · `internal_notes` · `content_meta` (governance layer over Sanity content: visibility floor, tags, live/paused/archived) · `system_settings` (feature flags & integration values — never secrets). Orders gain `assigned_to_id · advisor_id · priority · due_at · delivery_document_id · closed_at` and the extended status set (`internal_review`, `closed`); mandates gain `stage · probability · next_action · next_action_due`.

Tables cover every interaction: `users · sessions · auth_tokens · security_events · organisations · organisation_members · investor_profiles · investor_criteria · saved_opportunities · opportunity_views · saved_searches · scenarios · comparisons · orders · payments · mandates · mandate_milestones · enquiries · messages · notifications · document_grants · document_access_logs · document_requests · nda_agreements · portfolio_positions · capital_calls · audit.logs`.

**RLS posture** (sql/002_rls.sql): investors see only their own rows; advisors see assigned investors plus fulfilment tables; admins see all; audit inserts are always permitted. **The service-role key bypasses RLS by design** — investor isolation is enforced at the application layer (`requireApiUser`, tier checks, ownership filters on every read/write), with the SQL-level policies remaining in force as defense in depth for any non-service-role access path (e.g. PostgREST with anon/authenticated keys). Supabase deployments may swap `portal.current_user_id()` to `auth.uid()` to share the policies with PostgREST sessions.

**Concurrency note:** PostgREST has no multi-statement transactions — code that previously relied on `db.$transaction` runs sequential statements in the same order (marked `// NOTE: sequential` in source). Business-critical sequences (order → status event → revenue recognition) remain guarded by their read-then-write checks and full audit trails.

## Admin Internal System (`/admin`)

The operational backbone of the portal — a high-trust capital-operations platform for Murivest staff (not a generic CRM). Sign in with a staff account, then visit **/admin**.

**Roles (RBAC — enforced server-side in `src/lib/admin/rbac.ts` AND at the DB level by sql/005_admin_rls.sql):** Super Administrator · Operations Lead · Advisor (assigned investors only) · Compliance/KYC · Finance/Revenue · Content/Research · Read-Only Analyst. Bootstrap: `node scripts/create-admin.mjs <email> <name> <password>` (first Super Admin) or `node scripts/create-staff.mjs <email> <name> <password> <role> [title]`; afterwards create staff from Settings → Staff & roles (audit-logged).

**Modules** — Command Centre (Revenue Card + priority queues + activity feed + quick actions) · Investors & Organisations (verification, tiers, advisor assignment, freeze/escalate, full timeline) · Opportunities (Sanity inventory + tiered-visibility governance, tags, bulk archive/pause) · **Orders Engine** (pending → payment confirmed → in progress → internal review → ready → delivered → closed; payment verification, assignment, controlled refunds, automatic revenue recognition, delivery into the data room) · Mandates & pipeline (stage, win probability, weighted pipeline) · Documents/data-room control · Communications inbox · Compliance (KYC/AML queue, NDA tracking, tier progression, risk flags) · Market Intelligence CMS · Analytics suite (executive, investors, opportunities, orders, mandates, operational health — all with comparison periods) · **Finance & Revenue** (the full Revenue Card) · Settings & Security (staff/roles, feature flags, integrations, audit viewer, session monitor).

**Revenue rules** (applied everywhere, always labelled): revenue is recognised on delivery + verified payment (one ledger row per order); cash collected is shown alongside recognised revenue; net = gross − processing costs (configurable fee schedule) − approved refunds; refunds flow propose → Finance review; advisor attribution = order advisor ?? investor's advisor of record. Weighted pipeline = midpoint of target allocation × probability (active USD mandates); forecasts use explicit, labelled conventions.

**APIs**: `GET /api/admin/data?scope=…` (guarded reads), `POST /api/admin/action` (guarded writes — every action permission-checked and audit-logged), `GET /api/admin/export?dataset=orders|revenue|investors|mandates|opportunities|audit` (CSV for leadership/finance; the Revenue Card also prints to PDF).

## Notifications (multi-channel, both systems)

In-app centre + toasts/modals, Web Push (desktop + installed PWA, via Service Worker + VAPID), and transactional email — driven by one dispatcher and a per-investor channel × category preference matrix (Profile & Preferences → Notifications, deep-linked from every email footer).

- **Dispatcher** (`src/lib/notifications/dispatch.ts`): every material event funnels through `notifyUser()` — one notification row, per-channel fan-out honouring preferences / quiet hours / digest opt-in, a `NotificationDelivery` ledger row per attempt, and an audit entry. Payloads pushed or emailed are minimal and non-sensitive; confidential detail stays behind authentication.
- **Channels & events** (`src/lib/notifications/events.ts`): 8 categories (documents, orders, opportunities, studio, mandates, messages, security, system) × 3 channels, with the fine-grained event catalog (order.delivered, security.new_device, …) driving priorities, email templates and modal-worthy moments.
- **Real-time**: SSE at `/api/notifications/stream` feeds the toaster; the Service Worker (`public/sw.js`) receives push with the tab closed, mirrors into IndexedDB (offline notification centre), deep-links clicks and background-syncs read state.
- **Email**: exact institutional templates ship in code (`src/lib/notifications/email-defaults.ts`; exported to `download/murivest-email-templates/`), over your own SMTP; admins manage overrides + version history in Admin → Notifications → Email templates. Digest batches: `POST /api/cron/digest` with `Authorization: Bearer $CRON_SECRET`.
- **Admin operations** (`/admin/notifications`): delivery ledger with per-investor status, bounce/failure rates, manual redelivery, suppression overrides, controlled announcements (segments, fully audited; `broadcast.send` permission).
- **Schema**: row types in `src/lib/db-types.ts`; production DDL + RLS in `sql/006_notifications_schema.sql` (also `download/murivest-notifications-schema.sql`).
- **Push keys**: `node scripts/generate-vapid-keys.mjs --write` → `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` / `VAPID_SUBJECT` (mailto:) in env. Production must set `CRON_SECRET` for the digest endpoint.

## Sanity — the content source

**All properties, orderable briefs, data-room documents and market intelligence are uploaded through Sanity.** The portal never fabricates content.

```bash
cd sanity-studio
cp .env.example .env            # SANITY_STUDIO_PROJECT_ID (create at sanity.io/manage)
npm install && npm run dev      # http://localhost:3333 — author content
npm run deploy                  # host the studio for Murivest staff
```

Then in the Next.js app `.env`:

```
SANITY_PROJECT_ID=your-project-id
SANITY_DATASET=production
SANITY_API_READ_TOKEN=<read token>   # private dataset: required, server-only
```

Content types (schemas in `sanity-studio/schemas/`):

| Type | Drives |
| --- | --- |
| `opportunity` | Discover listings — `accessTier` gates visibility; financial fields, lease profile, rationale & risks additionally require Tier 2+ |
| `brief` | Orders catalogue — scope, delivery expectations, per-format pricing |
| `document` | Data room — `accessTier` + `downloadable` flag; streamed through `/api/documents/[id]/file` with access logging |
| `marketReport` | Market Intelligence |
| `landingContent` | Landing page hero copy + Director introduction video fields (optional overrides of the built-in sales-letter copy; `NEXT_PUBLIC_DIRECTOR_VIDEO_URL` / `_POSTER` / `_NAME` env fallbacks) |

Editorial rule: **never estimate a financial field** — empty fields render "not disclosed", the portal invents nothing.

## Security model

- **Authentication**: scrypt password hashing (memory-hard), opaque DB-backed sessions (sha-256 at rest, 30-day rolling, revocable per device), account lockout after repeated failures, TOTP MFA (RFC 6238, secret AES-256-GCM encrypted), magic links, single-use hashed email tokens.
- **Authorisation**: middleware cookie gate + full server-side session validation; investor-level permission checks on every read/write (`requireApiUser`, effective tier computation with NDA gating); RLS as database-level defense in depth.
- **Documents**: streamed through an authenticated route — Sanity asset URLs and the read token never reach the browser; preview-only documents disallow `?download=1`; every access logged.
- **Audit**: `audit_logs`, `security_events`, `document_access_logs` + DB-level triggers on orders, payments, permission changes and profile tier changes (production SQL).
- **Payments**: M-Pesa paybill confirmation + wire reference verification by the finance desk; card gateway is a documented integration point (env-driven) that reports honestly when not installed.
- No service secrets in the client bundle — Sanity token, session HMAC keys, gateway keys live server-side only.

## Landing page & downloadable resources

The public landing page is a long-form sales letter (Ogilvy-style structure, NEPQ-style tone): situation → problem → consequence → the portal's answer → “what Murivest is not” → graduated access → objection handling → close. It embeds the **Director's introduction video** (configure via Sanity `landingContent` or the `NEXT_PUBLIC_DIRECTOR_VIDEO_*` env vars) and offers two permanent downloads served from `public/downloads/`:

- `murivest-portal-user-manual.pdf` — the step-by-step investor manual (also delivered in `download/`)
- `murivest-director-video-script.md` — the word-for-word production script for the Director's video

## Deployment & operations

```bash
cp .env.example .env              # fill in NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY
bun install                       # or npm/yarn/pnpm
# Provision Supabase once (see Database above): run sql/001…006 in the SQL
# editor or psql, expose `portal` + `audit` schemas, then bootstrap:
node scripts/create-admin.mjs office@murivest.com 'Full Name' 'Passw0rd!'   # first admin
bun run dev                       # dev server
```

Production runtime (`bun run start`, standalone server) — export the environment before starting: `NEXT_PUBLIC_SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` (see *Database* above), `SESSION_SECRET` / `APP_ENCRYPTION_KEY`, `SANITY_*`, `SMTP_*`, `VAPID_*`, `CRON_SECRET`. `NEXT_PUBLIC_*` values are inlined at build time — set them before `next build`. See `.env.example` for the full annotated template.

Staff desk operations (verification, tier assignment, order/payment progression, advisor replies, mandate activation, document grants) run through the guarded, audit-logged `POST /api/staff` dispatcher — integrate with existing Murivest fulfilment workflows, or call from internal tooling as an admin/advisor session.

Email delivery runs over **your own SMTP server** (no Resend or third-party API): set `SMTP_HOST`, `SMTP_PORT` (587 STARTTLS / 465 TLS), `SMTP_SECURE` (blank = auto), `SMTP_USER`, `SMTP_PASS` and `MAIL_FROM` in `.env`. Credentials are read from the environment only and never logged. The `ALLOW_DEV_AUTH_LINKS=true` flag (dev only) returns auth links in API responses so journeys remain testable before SMTP is configured — **never enable in production**.

## Financial calculation transparency

The Investment Studio's formulas are documented inline (`src/lib/finance/engine.ts`): NOI = gross − opex; total capital = price × (1 + costs%); debt annuitises after the interest-only window; exit value = exit NOI ÷ cap rate or explicit value; IRR solves the levered cash-flow vector by bisection. Every output is labelled illustrative; actuals (Portfolio) are always visually separated from projections (Studio).

---

© Murivest Group Ltd · 4th Avenue Parklands, Diamond Plaza, Nairobi · +254 115 277 610 · office@murivest.com
Mandate-only engagements · fiduciary standards · KYC/AML verified · Murivest does not pool capital or operate collective investment schemes.
