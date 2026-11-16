import {NextResponse, type NextRequest} from 'next/server'
import {supabase, unwrap, unwrapNullable, toCamel, toCamelList, nowIso, newId} from '@/lib/supabase'
import {savedSearchSchema} from '@/lib/validation'
import {requireApiUser, isResponse} from '@/lib/auth/context'
import {parseBody, fail} from '@/lib/api'
import type {SavedSearchRow} from '@/lib/db-types'

/** GET — investor's saved searches & alert rules. */
export async function GET() {
  const guard = await requireApiUser()
  if (isResponse(guard)) return guard.response
  const searches = toCamelList(
    unwrap<SavedSearchRow[]>(
      await supabase
        .from('saved_searches')
        .select('*')
        .eq('user_id', guard.ctx.user.id)
        .order('created_at', {ascending: false}),
      'savedSearches.list',
    ),
  )
  return NextResponse.json({ok: true, searches})
}

/** POST — save a Discover filter set, optionally with new-match alerts. */
export async function POST(req: NextRequest) {
  const guard = await requireApiUser()
  if (isResponse(guard)) return guard.response
  const parsed = await parseBody(req, savedSearchSchema)
  if ('response' in parsed) return parsed.response
  const searchRow = unwrap<SavedSearchRow>(
    await supabase
      .from('saved_searches')
      .insert({
        id: newId(),
        user_id: guard.ctx.user.id,
        name: parsed.data.name,
        filters: parsed.data.filters,
        alert_on_new: parsed.data.alertOnNew ?? false,
        created_at: nowIso(),
      })
      .select('*')
      .single(),
    'savedSearches.create',
  )
  const search = toCamel(searchRow)
  return NextResponse.json({ok: true, search})
}

/** DELETE — remove a saved search. */
export async function DELETE(req: NextRequest) {
  const guard = await requireApiUser()
  if (isResponse(guard)) return guard.response
  const id = req.nextUrl.searchParams.get('id')
  if (!id) return fail('Provide the search id.')
  const existing = unwrapNullable<SavedSearchRow>(
    await supabase.from('saved_searches').select('id').eq('id', id).eq('user_id', guard.ctx.user.id).maybeSingle(),
    'savedSearches.get',
  )
  if (!existing) return fail('Saved search not found.', 404)
  unwrap(
    await supabase.from('saved_searches').delete().eq('id', id),
    'savedSearches.delete',
  )
  return NextResponse.json({ok: true})
}

export const dynamic = 'force-dynamic'
