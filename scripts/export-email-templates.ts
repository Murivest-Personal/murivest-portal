/**
 * Export the platform's transactional email templates to
 * download/murivest-email-templates/:
 *   <key>.html          — the EXACT template ({{placeholders}} kept)
 *   <key>.preview.html  — the same template with representative values, for
 *                         visual review in a browser
 *   README.md           — index with subjects, categories, placeholders
 *
 * Run: bun run scripts/export-email-templates.ts   (bun resolves the TS import)
 */
import {EMAIL_TEMPLATES} from '../src/lib/notifications/email-defaults'
import {mkdirSync, writeFileSync} from 'node:fs'

const OUT = 'download/murivest-email-templates'

const PREVIEW_VARS: Record<string, Record<string, string>> = {
  document_ready: {firstName: 'Amara', documentTitle: 'Westlands Ridge — Institutional Brief', documentNote: ' with download permission', link: 'https://investors.murivest.com/portal/documents'},
  new_match: {firstName: 'Amara', opportunityTitle: 'Off-market logistics estate, Athi River', matchNote: ' — matching your logistics mandate', link: 'https://investors.murivest.com/portal/discover'},
  order_confirmation: {firstName: 'Amara', briefTitle: 'Westlands Ridge — Institutional Brief', orderRef: 'MVR-ORD-4K7Q2A', orderScope: '', amountLine: 'Amount due: KES 45,000.', link: 'https://investors.murivest.com/portal/orders'},
  brief_status: {firstName: 'Amara', briefTitle: 'Westlands Ridge — Institutional Brief', orderRef: 'MVR-ORD-4K7Q2A', statusLabel: 'In Progress', statusNote: 'Your research analyst has begun preparation; typical turnaround is 5 working days.', link: 'https://investors.murivest.com/portal/orders'},
  brief_delivered: {firstName: 'Amara', briefTitle: 'Westlands Ridge — Institutional Brief', orderRef: 'MVR-ORD-4K7Q2A', link: 'https://investors.murivest.com/portal/documents'},
  mandate_update: {firstName: 'Amara', mandateRef: 'MVR-MND-8XT2P1', mandateTitle: 'Nairobi Grade A income acquisition', mandateStatus: 'activated', mandateNote: 'Your acquisition mandate is live. Matching opportunities will be surfaced in Discover and communicated by your advisor.', link: 'https://investors.murivest.com/portal/mandates'},
  advisor_message: {firstName: 'Amara', advisorName: 'Daniel Mwangi', messagePreview: 'The vendor has shared updated rent rolls for the Westlands Ridge — worth reviewing against your yield assumptions before Friday’s call.', link: 'https://investors.murivest.com/portal/activity'},
  security_alert: {firstName: 'Amara', alertTitle: 'New sign-in detected', alertDetail: 'A new device (MacBook Pro, Nairobi) signed in to your Murivest workspace. If this was not you, revoke the session immediately.', link: 'https://investors.murivest.com/portal/security'},
  platform_notice: {firstName: 'Amara', noticeTitle: 'Scheduled maintenance window', noticeBody: 'The portal will be unavailable on Saturday 02:00–04:00 EAT while we upgrade the secure document pipeline. No action is required from you.', link: 'https://investors.murivest.com/portal'},
  weekly_digest: {
    firstName: 'Amara',
    digestCount: '3',
    digestPlural: 's',
    itemsHtml: '<ul style="margin:0 0 16px;padding-left:18px;"><li style="margin-bottom:10px;"><strong style="color:#1B4332;">New opportunity matching your criteria</strong><br><span style="color:#6B6B60;">Off-market logistics estate, Athi River — aligned with your logistics mandate.</span></li><li style="margin-bottom:10px;"><strong style="color:#1B4332;">Mandate MVR-MND-8XT2P1 activated</strong></li><li style="margin-bottom:10px;"><strong style="color:#1B4332;">Market report available</strong></li></ul>',
    itemsText: '- New opportunity matching your criteria\n- Mandate MVR-MND-8XT2P1 activated\n- Market report available',
    link: 'https://investors.murivest.com/portal',
  },
}

function fill(template, vars) {
  return template.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_m, token) => vars[token] ?? `{{${token}}}`)
}

mkdirSync(OUT, {recursive: true})

const rows: {key: string; category: string; subject: string; placeholders: string[]}[] = []
for (const t of Object.values(EMAIL_TEMPLATES)) {
  const base = {link: t.placeholders.includes('link') ? 'https://investors.murivest.com/portal' : undefined, prefsUrl: 'https://investors.murivest.com/portal/notifications'}
  writeFileSync(`${OUT}/${t.key}.html`, t.bodyHtml, 'utf8')
  writeFileSync(`${OUT}/${t.key}.preview.html`, fill(t.bodyHtml, {...base, ...(PREVIEW_VARS[t.key] ?? {})}), 'utf8')
  rows.push({key: t.key, category: t.category, subject: t.subject, placeholders: t.placeholders})
}

const readme = `# Murivest — Transactional Email Templates (exact)

These are the exact default templates the platform ships with (source of truth:
\`src/lib/notifications/email-defaults.ts\`). Active rows in \`portal.email_templates\`
(admin → Notifications → Email templates) override them per key; every edit is
versioned in \`portal.email_template_versions\`.

## Files

| Template | Category | Subject line | Placeholders |
|---|---|---|---|
${rows.map((r) => `| \`${r.key}.html\` | ${r.category} | ${r.subject} | ${r.placeholders.map((p) => `{{${p}}}`).join(', ')} |`).join('\n')}

Each \`.preview.html\` shows the same template with representative values filled
in, for visual review in a browser.

## Design rules (spec §6)

- Clean, institutional, on-brand: deep forest green \`#0E2A1C\` header, cream
  \`#FAF9F6\` body, restrained gold \`#B8956B\` rule — table-based layout with
  inline styles for email-client compatibility.
- One clear subject line; one primary call-to-action button.
- Footer carries the notification-preference management link
  ({{prefsUrl}} → /portal/notifications) and the confidentiality notice.
- No marketing content inside transactional emails, ever.
- Delivery: immediate for high-priority events (security, brief delivered,
  advisor message); digest-eligible categories (opportunities, studio,
  mandates, announcements) fold into one summary when the investor opts in.

## Brand tokens

| Token | Value |
|---|---|
| Forest | \`#1B4332\` |
| Forest deep | \`#0E2A1C\` |
| Ivory / cream | \`#FAF9F6\` |
| Gold | \`#B8956B\` |
| Body ink | \`#33322D\` |
| Muted | \`#6B6B60\` |

Send infrastructure: Murivest's own SMTP (SMTP_HOST / SMTP_PORT / SMTP_USER /
SMTP_PASS / MAIL_FROM env). No third-party mail API is used.
`
writeFileSync(`${OUT}/README.md`, readme, 'utf8')
console.log(`Exported ${rows.length} templates (+ previews + README) to ${OUT}/`)
