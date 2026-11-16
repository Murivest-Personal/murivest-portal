#!/usr/bin/env node
/**
 * Platform/preview database hook (replaces the former `prisma db push`).
 *
 * The application runtime stores ALL data in Supabase via the service-role
 * client (src/lib/supabase.ts) — there is no local database engine any more.
 * The preview build pipeline still invokes `bun run db:push` with a SQLite
 * file URL and expects that file to exist afterwards: satisfy the pipeline
 * by touching the file, then exit successfully. In any other environment,
 * print the real provisioning path (DDL via psql — see sql/ and README).
 */
import {mkdirSync, writeFileSync, existsSync} from 'node:fs'
import {dirname} from 'node:path'

const url = process.env.DATABASE_URL || ''

if (url.startsWith('file:')) {
  const target = url.slice('file:'.length).replace(/\?.*$/, '')
  if (!existsSync(target)) {
    mkdirSync(dirname(target), {recursive: true})
    writeFileSync(target, '')
  }
  console.log(`[db] runtime storage is Supabase — local file satisfied: ${target}`)
  process.exit(0)
}

console.log(
  '[db] Runtime storage is Supabase (src/lib/supabase.ts). ' +
    'To provision the database, apply sql/001_schema.sql … sql/006_notifications_schema.sql ' +
    'with psql (session pooler / direct connection) and set NEXT_PUBLIC_SUPABASE_URL + ' +
    'SUPABASE_SERVICE_ROLE_KEY. See README → Database.',
)
