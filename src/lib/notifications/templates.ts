import {supabase, unwrap, unwrapNullable, toCamel, toSnake, nowIso, newId} from '@/lib/supabase'
import type {EmailTemplateRow, EmailTemplateVersionRow} from '@/lib/db-types'
import {COMPANY} from '@/lib/constants'
import {EMAIL_TEMPLATES} from './email-defaults'

/**
 * Email template resolution: an active row in portal.email_templates
 * overrides the code default for its key. Placeholders use {{token}} and
 * render as empty when missing — payloads are deliberately minimal and
 * non-sensitive (spec §9: detail lives inside the authenticated portal).
 */

export interface RenderedEmail {
  subject: string
  html: string
  text: string
}

function fill(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_m, token: string) => vars[token] ?? '')
}

export function baseVars(extra: Record<string, string>): Record<string, string> {
  const siteUrl = COMPANY.siteUrl
  return {
    siteUrl,
    prefsUrl: `${siteUrl}/portal/notifications`,
    ...extra,
  }
}

/** Resolve + render a template for a given key (DB row wins over code default). */
export async function renderEmail(key: string, vars: Record<string, string>): Promise<RenderedEmail> {
  const fallback = EMAIL_TEMPLATES[key]
  // DB hiccup falls back to the code default (was .catch(() => null)).
  let row: EmailTemplateRow | null = null
  try {
    row = unwrapNullable<EmailTemplateRow>(
      await supabase.from('email_templates').select('*').eq('key', key).maybeSingle(),
      'emailTemplates.byKey',
    )
  } catch {
    row = null
  }
  const active = row && row.is_active ? toCamel(row) : null

  const subject = active?.subject ?? fallback?.subject ?? 'Murivest portal notification'
  const preheader = active?.preheader ?? fallback?.preheader ?? ''
  const html = active?.bodyHtml ?? fallback?.bodyHtml ?? ''
  const text = active?.bodyText ?? fallback?.bodyText ?? ''

  const v = baseVars(vars)
  // The preheader is baked into the default layout already; for admin rows the
  // subject stands alone and the preheader is prepended to the text body.
  const renderedHtml = fill(html, v)
  const renderedText = fill(text, v).trim()

  return {
    subject: fill(subject, v).trim(),
    html: renderedHtml,
    text: renderedText,
  }
}

/** Admin template upsert — writes a new immutable version row on every save. */
export async function saveEmailTemplate(params: {
  key: string
  category: string
  subject: string
  preheader?: string | null
  bodyHtml: string
  bodyText: string
  isActive: boolean
  savedById: string
}): Promise<{version: number}> {
  const existingRow = unwrapNullable<EmailTemplateRow>(
    await supabase.from('email_templates').select('*').eq('key', params.key).maybeSingle(),
    'emailTemplates.byKey',
  )
  const existing = existingRow ? toCamel(existingRow) : null
  const fallback = EMAIL_TEMPLATES[params.key]

  if (!existing && !fallback) {
    throw new Error(`Unknown template key: ${params.key}`)
  }

  // NOTE: sequential read-then-write — Prisma's atomic version increment has
  // no PostgREST equivalent (no multi-statement tx over PostgREST).
  const nextVersion = existing ? existing.version + 1 : 1
  const templateRow = existing
    ? unwrap<EmailTemplateRow>(
        await supabase
          .from('email_templates')
          .update(
            toSnake({
              category: params.category,
              subject: params.subject,
              preheader: params.preheader ?? null,
              bodyHtml: params.bodyHtml,
              bodyText: params.bodyText,
              isActive: params.isActive,
              version: nextVersion,
              updatedById: params.savedById,
            }),
          )
          .eq('key', params.key)
          .select('*')
          .single(),
        'emailTemplates.update',
      )
    : unwrap<EmailTemplateRow>(
        await supabase
          .from('email_templates')
          .insert(
            toSnake({
              id: newId(),
              key: params.key,
              category: params.category,
              subject: params.subject,
              preheader: params.preheader ?? null,
              bodyHtml: params.bodyHtml,
              bodyText: params.bodyText,
              isActive: params.isActive,
              version: 1,
              updatedById: params.savedById,
              createdAt: nowIso(),
              updatedAt: nowIso(),
            }),
          )
          .select('*')
          .single(),
        'emailTemplates.create',
      )
  const template = toCamel(templateRow)

  unwrap<EmailTemplateVersionRow>(
    await supabase
      .from('email_template_versions')
      .insert(
        toSnake({
          id: newId(),
          templateId: template.id,
          version: template.version,
          subject: params.subject,
          preheader: params.preheader ?? null,
          bodyHtml: params.bodyHtml,
          bodyText: params.bodyText,
          savedById: params.savedById,
          createdAt: nowIso(),
        }),
      )
      .select('*')
      .single(),
    'emailTemplateVersions.create',
  )

  return {version: template.version}
}
