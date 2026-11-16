# Codemod spec — Prisma → Supabase JS client conversion

## Goal

Replace EVERY use of Prisma (`db.` from `@/lib/db`, `PrismaClient`, `withUserContext`,
`db.$transaction`, `db.$queryRaw`) with the Supabase client from `@/lib/supabase`.
After conversion the file must contain NO Prisma imports and NO `db.` calls.

**Read before converting:** `scripts/codemod-mapping.md` file `src/lib/supabase.ts` (the client module) and `scripts/codemod-mapping.md` (every model → table, field → column). The mapping doc is the authoritative name source — never guess a table/column name.

## The new module (src/lib/supabase.ts)

```ts
import {supabase, unwrap, unwrapNullable, unwrapCount, toCamel, toCamelList, toSnake, nowIso, newId, auditTable} from '@/lib/supabase'
// also: isSupabaseConfigured() for health/status surfaces
```

- `supabase` — service-role client, default schema `portal`. Use `.from('<table>')` with the **snake_case plural** table names from the mapping doc.
- `auditTable()` — handle for the `audit.logs` table (audit schema). Use for ALL audit log writes (model `AuditLog` → call `auditTable()` instead of `supabase.from('logs')`).
- **Explicit generic required:** `unwrap<T>(res, ctx)` / `unwrapNullable<T>(res, ctx)` — the client is untyped, so ALWAYS pass the row type: `unwrap<OrderRow[]>(res, 'orders.list')`, `unwrapNullable<SessionRow>(res, 'session.byToken')`. Throw on error, return data otherwise.
- `unwrapCount(res, ctx)` — takes the whole response of a `{count: 'exact', head: true}` select (no generic).
- `toCamel(row)` / `toCamelList(rows)` — snake_case row → camelCase object (app code keeps camelCase).
- `toSnake(obj)` — camelCase payload → snake_case for insert/update.
- `newId()` — row id (replaces Prisma cuid; DDL ids are TEXT with NO default → every insert MUST set id).
- `nowIso()` — ISO timestamp for created_at / explicit timestamp columns.

**Empirical supabase-js v2.119 rules (verified against the installed typings):**
- `.ne()` does NOT typecheck — use `.not('col', 'eq', v)` or `.filter('col', 'neq', v)`.
- Verified working on builders: `.eq .in .or .ilike .like .gt .gte .lt .lte .contains .is .not .order .limit .range .maybeSingle .single`, `select('*', {count:'exact', head:true})`, `upsert(rows, {onConflict: 'user_id'})`, `insert(...).select('*').single()`.
- Avoid conditional re-chaining of builders; write the full chain in each branch when narrowing bites.

## Hard rules

1. **Imports:** remove `import {db} from '@/lib/db'` and any `@prisma/client` import. Add only what you use from `@/lib/supabase`. Import row types from `@/lib/db-types` (`import type {OrderRow} from '@/lib/db-types'`) when typing helps.
2. **Reads return camelCase:** wrap rows with `toCamel` / `toCamelList` immediately after `unwrap` so all downstream code (business logic, JSON APIs, UI) keeps using camelCase unchanged.
3. **Writes take snake_case:** build payloads with snake_case keys (or `toSnake(camelPayload)`).
4. **Do NOT change**: function signatures, return shapes, zod schemas, business logic, status/enum string values, email/audit side effects, route status codes. The refactor is storage-layer only.
5. **`withUserContext(...)` calls:** delete the wrapper, call the inner code directly on `supabase`. RLS context-setting is obsolete (service role bypasses RLS; app-layer guards already run before every query).
6. **Transactions** (`db.$transaction(async tx => {...})`): there is no multi-statement transaction over PostgREST. Replace with sequential awaited statements on `supabase` in the same order; add a one-line comment `// NOTE: sequential (no multi-table tx over PostgREST)` where atomicity was lost.
7. **`db.$queryRaw` / `$executeRawUnsafe`:** replace with `.select()` queries + TypeScript-side computation (groupBy/sum/avg in JS) or `.rpc('<function>')` for functions in sql/003_functions.sql (`create_admin`, `purge_expired`, `most_viewed_opportunities`, `investor_activity`). Keep results identical.
8. **Timestamps/Dates:** supabase returns ISO strings. `new Date(row.createdAt)` and date-fns still work. When code READ `.createdAt` as Date and manipulates with Date methods (`getTime`, `getFullYear`), keep `new Date(...)` conversions.
9. **id/created_at on INSERT:** always include `id: newId()` and `created_at: nowIso()` (plus `updated_at: nowIso()` when the table has it). DB triggers maintain `updated_at` on UPDATE — do not set it on update calls.
10. **Prisma `include`/relation fields:** replace with a follow-up query + JS join, e.g. `const orders = ...; const payments = unwrap(await supabase.from('payments').select('*').in('order_id', ids))` then group in JS. NEVER use PostgREST embeds (`select('*, payments(*)')`) — separate queries only.
11. **Null filters:** `where: {field: null}` → `.is('field', null)`. `whereNot: {field: null}` → `.not('field', 'is', null)`.
12. **`OR` conditions:** `.or('col.eq.val,col2.eq.val2')` (values with quotes when strings: `col.eq."value"`). Prefer two simpler queries when complex.
13. **Case-insensitive search** (`mode: 'insensitive'`, `contains`): `.ilike('col', `%${term}%`)`.
14. **Arrays stored in JSONB** (e.g. `sanity_ids`, `geographies`): pass JS arrays directly; read back as arrays. No change in app-side handling.
15. **Count:** `db.x.count()` → `unwrapCount(await supabase.from('x').select('*', {count: 'exact', head: true}).<filters>)`. NOTE: `unwrapCount` takes the whole response object.
16. **updateMany/deleteMany:** PostgREST applies filters to update/delete: `.update(payload).eq('user_id', id)` — add `.select()` when the code used the returned rows, otherwise omit.
17. **findUnique on compound unique** (e.g. `userId_documentId`): `.eq('user_id', uid).eq('sanity_document_id', docId).maybeSingle()`.
18. **upsert:** `db.x.upsert({where, update, create})` → `.upsert([toSnake(row)], {onConflict: 'user_id'})` (conflict target = the unique columns).
19. **Never** leave a `db.` reference, a `Prisma` type import, or a camelCase column name in `.eq()/.update()/.insert()/.order()`.
20. Keep file-level comments coherent; update any comment that references Prisma.

## Canonical patterns

```ts
// BEFORE (Prisma)
const orders = await db.order.findMany({
  where: {userId: user.id, status: {in: ['pending', 'in_progress']}},
  orderBy: {createdAt: 'desc'},
  take: 20,
})
const one = await db.order.findUnique({where: {id}, include: {payments: true}})
const cnt = await db.payment.count({where: {orderId}})
await db.order.update({where: {id}, data: {status: 'ready'}})

// AFTER (Supabase) — note the EXPLICIT generics and new Date() comparisons
const orders = toCamelList(unwrap<OrderRow[]>(await supabase.from('orders')
  .select('*')
  .eq('user_id', user.id)
  .in('status', ['pending', 'in_progress'])
  .order('created_at', {ascending: false})
  .limit(20), 'orders.list'))

const orderRow = unwrapNullable<OrderRow>(await supabase.from('orders')
  .select('*').eq('id', id).maybeSingle(), 'orders.get')
const order = orderRow ? toCamel(orderRow) : null
const payments = orderRow
  ? toCamelList(unwrap<PaymentRow[]>(await supabase.from('payments').select('*').eq('order_id', id), 'payments.list'))
  : []

const cnt = unwrapCount(await supabase.from('payments')
  .select('*', {count: 'exact', head: true}).eq('order_id', id))

const updatedRow = unwrap<OrderRow>(await supabase.from('orders')
  .update({status: 'ready'}).eq('id', id).select('*').single(), 'orders.update') // trigger maintains updated_at
```

Inserts:

```ts
const row = toSnake({id: newId(), userId: user.id, status: 'open', createdAt: nowIso()})
const inserted = unwrap(await supabase.from('enquiries').insert(row).select('*').single(), 'enquiries.create')
return toCamel(inserted)
```

## Reporting

For every assigned file report: converted / skipped (why) / any behaviour notes (lost atomicity, query shape changes). List any place you were unsure about a name — do not guess.
