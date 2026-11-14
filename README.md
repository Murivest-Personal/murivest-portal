# Murivest Private Capital Portal

Institutional & UHNWI investment workspace for **Murivest Group Ltd** — a private capital allocation environment for UHNWIs, family offices and institutional investors across East Africa (Nairobi), the United Kingdom (London) and international markets.

Built as a **clean, purpose-built institutional product**: Next.js 16 (App Router, TypeScript), Tailwind CSS 4, shadcn/ui, Prisma, **Sanity as the single content source** (properties, briefs, data-room documents, market intelligence), DB-backed sessions with scrypt + TOTP MFA, and **zero sample data** — every surface renders purposeful empty states until real content is published.

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

## Database

Two views of one model:

- **Runtime (dev/sandbox)**: Prisma + SQLite (`prisma/schema.prisma`). `bun run db:push` keeps it in sync.
- **Production**: PostgreSQL DDL in `sql/`:

```bash
psql "$DATABASE_URL" -f sql/001_schema.sql   # 27 tables + enums + triggers + audit capture
psql "$DATABASE_URL" -f sql/002_rls.sql      # Row Level Security (investor isolation, advisor/admin roles)
psql "$DATABASE_URL" -f sql/003_functions.sql # create_admin, purge_expired, most-viewed rollups
```

Tables cover every interaction: `users · sessions · auth_tokens · security_events · organisations · organisation_members · investor_profiles · investor_criteria · saved_opportunities · opportunity_views · saved_searches · scenarios · comparisons · orders · payments · mandates · mandate_milestones · enquiries · messages · notifications · document_grants · document_access_logs · document_requests · nda_agreements · portfolio_positions · capital_calls · audit.logs`.

**RLS posture** (sql/002_rls.sql): investors see only their own rows; advisors see assigned investors plus fulfilment tables; admins see all; audit inserts from the app tier are always permitted. The trusted app sets `app.user_id` / `app.actor_role` per transaction (`withUserContext()` in `src/lib/db.ts`); Supabase deployments swap `portal.current_user_id()` to `auth.uid()`.

To run the app itself on PostgreSQL, change `provider = "sqlite"` → `"postgresql"` in `prisma/schema.prisma` and point `DATABASE_URL` at the instance.

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
| `landingContent` | Landing page hero copy (optional) |

Editorial rule: **never estimate a financial field** — empty fields render "not disclosed", the portal invents nothing.

## Security model

- **Authentication**: scrypt password hashing (memory-hard), opaque DB-backed sessions (sha-256 at rest, 30-day rolling, revocable per device), account lockout after repeated failures, TOTP MFA (RFC 6238, secret AES-256-GCM encrypted), magic links, single-use hashed email tokens.
- **Authorisation**: middleware cookie gate + full server-side session validation; investor-level permission checks on every read/write (`requireApiUser`, effective tier computation with NDA gating); RLS as database-level defense in depth.
- **Documents**: streamed through an authenticated route — Sanity asset URLs and the read token never reach the browser; preview-only documents disallow `?download=1`; every access logged.
- **Audit**: `audit_logs`, `security_events`, `document_access_logs` + DB-level triggers on orders, payments, permission changes and profile tier changes (production SQL).
- **Payments**: M-Pesa paybill confirmation + wire reference verification by the finance desk; card gateway is a documented integration point (env-driven) that reports honestly when not installed.
- No service secrets in the client bundle — Sanity token, session HMAC keys, gateway keys live server-side only.

## Deployment & operations

```bash
cp .env.example .env              # fill in
bun install                       # or npm/yarn/pnpm
bun run db:push                   # dev runtime schema
node scripts/create-admin.mjs office@murivest.com 'Full Name' 'Passw0rd!'   # first admin
bun run dev                       # dev server
```

Staff desk operations (verification, tier assignment, order/payment progression, advisor replies, mandate activation, document grants) run through the guarded, audit-logged `POST /api/staff` dispatcher — integrate with existing Murivest fulfilment workflows, or call from internal tooling as an admin/advisor session.

Email delivery: set `RESEND_API_KEY` (+ `MAIL_FROM`). The `ALLOW_DEV_AUTH_LINKS=true` flag (dev only) returns auth links in API responses so journeys are testable before SMTP provisioning — **never enable in production**.

## Financial calculation transparency

The Investment Studio's formulas are documented inline (`src/lib/finance/engine.ts`): NOI = gross − opex; total capital = price × (1 + costs%); debt annuitises after the interest-only window; exit value = exit NOI ÷ cap rate or explicit value; IRR solves the levered cash-flow vector by bisection. Every output is labelled illustrative; actuals (Portfolio) are always visually separated from projections (Studio).

---

© Murivest Group Ltd · 4th Avenue Parklands, Diamond Plaza, Nairobi · +254 115 277 610 · office@murivest.com
Mandate-only engagements · fiduciary standards · KYC/AML verified · Murivest does not pool capital or operate collective investment schemes.
