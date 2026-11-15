import {COMPANY} from '@/lib/constants'
import type {NotificationCategory} from './events'

/**
 * EXACT transactional email templates — the defaults the platform ships with.
 *
 * Design principles (spec §6): clean, institutional, on-brand (Murivest
 * forest green + restrained gold); clear subject lines; ONE primary
 * call-to-action; footer with notification-preference management link; zero
 * marketing content inside transactional mail.
 *
 * Layout is table-based with inline styles for email-client compatibility.
 * Placeholders use {{token}} syntax and are filled by renderTemplate()
 * (templates.ts). Admin-managed rows in portal.email_templates override
 * these defaults per key; the version history keeps edits auditable.
 */

const GREEN = '#1B4332'
const GREEN_DEEP = '#0E2A1C'
const CREAM = '#FAF9F6'
const GOLD = '#B8956B'
const INK = '#33322D'
const MUTED = '#6B6B60'
const LINE = '#E3E0D8'
const BG = '#F2F1EC'

const SERIF = "Georgia,'Times New Roman',serif"
const SANS = "Arial,Helvetica,sans-serif"

export interface EmailTemplateContent {
  key: string
  category: NotificationCategory
  subject: string
  preheader: string
  bodyHtml: string
  bodyText: string
  /** Placeholders the template understands (shown in the admin editor). */
  placeholders: string[]
}

/** Shared institutional shell — every template renders inside this. */
function layout(opts: {
  heading: string
  bodyHtml: string
  ctaLabel: string
  ctaUrl: string
  ctaNote?: string
  preheader: string
}): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta http-equiv="X-UA-Compatible" content="IE=edge">
<title>Murivest</title>
</head>
<body style="margin:0;padding:0;background-color:${BG};-webkit-text-size-adjust:100%;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${opts.preheader}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:${BG};">
<tr><td align="center" style="padding:32px 16px;">
<table role="presentation" width="560" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:560px;background-color:${CREAM};border:1px solid ${LINE};">
<tr><td style="background-color:${GREEN_DEEP};padding:26px 36px;">
<div style="font-family:${SERIF};font-size:19px;letter-spacing:5px;color:${CREAM};">MURIVEST</div>
<div style="margin-top:7px;width:40px;height:2px;background-color:${GOLD};"></div>
<div style="margin-top:10px;font-family:${SANS};font-size:10px;letter-spacing:2px;text-transform:uppercase;color:#8FA295;">Private capital portal</div>
</td></tr>
<tr><td style="padding:36px;">
<h1 style="margin:0 0 18px;font-family:${SERIF};font-size:21px;line-height:1.4;color:${GREEN};font-weight:normal;">${opts.heading}</h1>
<div style="font-family:${SANS};font-size:14px;line-height:1.8;color:${INK};">${opts.bodyHtml}</div>
<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:30px 0 10px;">
<tr><td style="background-color:${GREEN};">
<a href="${opts.ctaUrl}" style="display:inline-block;padding:14px 34px;font-family:${SANS};font-size:11px;letter-spacing:2px;text-transform:uppercase;color:${CREAM};text-decoration:none;border:1px solid ${GREEN};">${opts.ctaLabel}</a>
</td></tr>
</table>
${opts.ctaNote ? `<p style="margin:4px 0 0;font-family:${SANS};font-size:11px;line-height:1.7;color:${MUTED};">${opts.ctaNote}</p>` : ''}
</td></tr>
<tr><td style="background-color:#F4F2EC;border-top:1px solid ${LINE};padding:24px 36px;">
<p style="margin:0;font-family:${SANS};font-size:11px;line-height:1.75;color:${MUTED};">
Murivest Group Ltd &middot; ${COMPANY.address} &middot; Principal offices: Nairobi &middot; London<br>
This message and any attachments are confidential and intended solely for the named recipient. If you have received it in error, please notify ${COMPANY.email} and delete it; you must not disclose or use its contents.<br>
<a href="{{prefsUrl}}" style="color:${GREEN};text-decoration:underline;">Manage your notification preferences</a>
</p>
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`
}

const para = (text: string) => `<p style="margin:0 0 16px;">${text}</p>`

export const EMAIL_TEMPLATES: Record<string, EmailTemplateContent> = {
  document_ready: {
    key: 'document_ready',
    category: 'documents',
    subject: 'Document ready: {{documentTitle}}',
    preheader: 'A new document is available in your secure Document Room.',
    bodyHtml: layout({
      preheader: 'A new document is available in your secure Document Room.',
      heading: 'A document is available in your portal',
      bodyHtml:
        para('{{firstName}},') +
        para('{{documentTitle}} has been placed in your secure Document Room{{documentNote}}.') +
        para('Material is watermarked for your account and access is logged. If your access window expires before you have finished reviewing, your advisor can extend it.'),
      ctaLabel: 'View document',
      ctaUrl: '{{link}}',
      ctaNote: 'You will be asked to sign in to the Murivest portal to open the document.',
    }),
    bodyText: `{{firstName}},

{{documentTitle}} has been placed in your secure Document Room{{documentNote}}.

Open your portal to review it: {{link}}

Material is watermarked for your account and access is logged.

— Murivest Group Ltd, ${COMPANY.address}
Manage your notification preferences: {{prefsUrl}}`,
    placeholders: ['firstName', 'documentTitle', 'documentNote', 'link', 'prefsUrl'],
  },

  new_match: {
    key: 'new_match',
    category: 'opportunities',
    subject: 'New opportunity matching your criteria',
    preheader: 'A newly listed opportunity aligns with your stated criteria.',
    bodyHtml: layout({
      preheader: 'A newly listed opportunity aligns with your stated criteria.',
      heading: 'A new opportunity matches your criteria',
      bodyHtml:
        para('{{firstName}},') +
        para('{{opportunityTitle}} has been listed and aligns with the criteria saved in your Investment Studio{{matchNote}}.') +
        para('Opportunities of this character are frequently off-market and reviewed on a first-come basis under the NDA you have accepted.'),
      ctaLabel: 'Review opportunity',
      ctaUrl: '{{link}}',
      ctaNote: 'Sign in to Discover for the full profile, returns framing and document availability.',
    }),
    bodyText: `{{firstName}},

{{opportunityTitle}} has been listed and aligns with the criteria saved in your Investment Studio{{matchNote}}.

Review it in Discover: {{link}}

— Murivest Group Ltd, ${COMPANY.address}
Manage your notification preferences: {{prefsUrl}}`,
    placeholders: ['firstName', 'opportunityTitle', 'matchNote', 'link', 'prefsUrl'],
  },

  order_confirmation: {
    key: 'order_confirmation',
    category: 'orders',
    subject: 'Order confirmed: {{briefTitle}} ({{orderRef}})',
    preheader: 'Your order has been received and is confirmed.',
    bodyHtml: layout({
      preheader: 'Your order has been received and is confirmed.',
      heading: 'Order confirmed',
      bodyHtml:
        para('{{firstName}},') +
        para('We confirm receipt of your order <strong>{{orderRef}}</strong> — {{briefTitle}}{{orderScope}}.') +
        para('{{amountLine}}') +
        para('Your advisor will confirm payment and the preparation timeline. You can follow every status change in Orders.'),
      ctaLabel: 'Open order',
      ctaUrl: '{{link}}',
      ctaNote: 'Order reference {{orderRef}}. Keep this reference for all correspondence.',
    }),
    bodyText: `{{firstName}},

We confirm receipt of your order {{orderRef}} — {{briefTitle}}{{orderScope}}.

{{amountLine}}

Your advisor will confirm payment and the preparation timeline. Follow status changes in Orders: {{link}}

— Murivest Group Ltd, ${COMPANY.address}
Manage your notification preferences: {{prefsUrl}}`,
    placeholders: ['firstName', 'briefTitle', 'orderRef', 'orderScope', 'amountLine', 'link', 'prefsUrl'],
  },

  brief_status: {
    key: 'brief_status',
    category: 'orders',
    subject: 'Brief update: {{briefTitle}} — {{statusLabel}}',
    preheader: 'The status of your brief has changed.',
    bodyHtml: layout({
      preheader: 'The status of your brief has changed.',
      heading: 'Brief update — {{statusLabel}}',
      bodyHtml:
        para('{{firstName}},') +
        para('Your order <strong>{{orderRef}}</strong> ({{briefTitle}}) has moved to <strong>{{statusLabel}}</strong>.') +
        para('{{statusNote}}'),
      ctaLabel: 'Open order',
      ctaUrl: '{{link}}',
    }),
    bodyText: `{{firstName}},

Your order {{orderRef}} ({{briefTitle}}) has moved to {{statusLabel}}.

{{statusNote}}

Open Orders: {{link}}

— Murivest Group Ltd, ${COMPANY.address}
Manage your notification preferences: {{prefsUrl}}`,
    placeholders: ['firstName', 'briefTitle', 'orderRef', 'statusLabel', 'statusNote', 'link', 'prefsUrl'],
  },

  brief_delivered: {
    key: 'brief_delivered',
    category: 'orders',
    subject: 'Brief delivered: {{briefTitle}} ({{orderRef}})',
    preheader: 'Your brief is ready in your secure Document Room.',
    bodyHtml: layout({
      preheader: 'Your brief is ready in your secure Document Room.',
      heading: 'Your brief has been delivered',
      bodyHtml:
        para('{{firstName}},') +
        para('{{briefTitle}} has been delivered to your secure Document Room under order <strong>{{orderRef}}</strong>.') +
        para('The document is watermarked for your account, access is logged, and any supporting annexes are filed alongside it.'),
      ctaLabel: 'Open Document Room',
      ctaUrl: '{{link}}',
      ctaNote: 'Sign in to the portal to download. Your advisor is available for a walkthrough of the analysis.',
    }),
    bodyText: `{{firstName}},

{{briefTitle}} has been delivered to your secure Document Room under order {{orderRef}}.

Open the Document Room: {{link}}

The document is watermarked for your account and access is logged.

— Murivest Group Ltd, ${COMPANY.address}
Manage your notification preferences: {{prefsUrl}}`,
    placeholders: ['firstName', 'briefTitle', 'orderRef', 'link', 'prefsUrl'],
  },

  mandate_update: {
    key: 'mandate_update',
    category: 'mandates',
    subject: 'Mandate update: {{mandateRef}}',
    preheader: 'Progress on your acquisition mandate.',
    bodyHtml: layout({
      preheader: 'Progress on your acquisition mandate.',
      heading: 'Mandate update',
      bodyHtml:
        para('{{firstName}},') +
        para('Your mandate <strong>{{mandateRef}}</strong> — {{mandateTitle}} — has progressed: {{mandateStatus}}.') +
        para('{{mandateNote}}'),
      ctaLabel: 'Open mandate',
      ctaUrl: '{{link}}',
      ctaNote: 'Your advisor keeps the mandate brief, milestones and linked opportunities up to date in your portal.',
    }),
    bodyText: `{{firstName}},

Your mandate {{mandateRef}} — {{mandateTitle}} — has progressed: {{mandateStatus}}.

{{mandateNote}}

Open your mandate: {{link}}

— Murivest Group Ltd, ${COMPANY.address}
Manage your notification preferences: {{prefsUrl}}`,
    placeholders: ['firstName', 'mandateRef', 'mandateTitle', 'mandateStatus', 'mandateNote', 'link', 'prefsUrl'],
  },

  advisor_message: {
    key: 'advisor_message',
    category: 'messages',
    subject: 'New message from your Murivest advisor',
    preheader: '{{advisorName}} has sent you a message.',
    bodyHtml: layout({
      preheader: '{{advisorName}} has sent you a message.',
      heading: 'New message from {{advisorName}}',
      bodyHtml:
        para('{{firstName}},') +
        para(`<em style="color:${MUTED};">&ldquo;{{messagePreview}}&rdquo;</em>`) +
        para('Reply within your portal — replies reach your advisor directly and keep the full thread on the record.'),
      ctaLabel: 'Read &amp; reply',
      ctaUrl: '{{link}}',
    }),
    bodyText: `{{firstName}},

{{advisorName}} sent you a message:

"{{messagePreview}}"

Read and reply in your portal: {{link}}

— Murivest Group Ltd, ${COMPANY.address}
Manage your notification preferences: {{prefsUrl}}`,
    placeholders: ['firstName', 'advisorName', 'messagePreview', 'link', 'prefsUrl'],
  },

  security_alert: {
    key: 'security_alert',
    category: 'security',
    subject: '{{alertTitle}} — your Murivest account',
    preheader: 'A security-relevant change occurred on your account.',
    bodyHtml: layout({
      preheader: 'A security-relevant change occurred on your account.',
      heading: '{{alertTitle}}',
      bodyHtml:
        para('{{firstName}},') +
        para('{{alertDetail}}') +
        para(`If this was you, no action is needed. If it was not, contact us immediately at ${COMPANY.phone} or ${COMPANY.email}.`),
      ctaLabel: 'Review account security',
      ctaUrl: '{{link}}',
      ctaNote: 'Account &amp; Security shows your active sessions, MFA settings and full sign-in history.',
    }),
    bodyText: `{{firstName}},

{{alertTitle}}

{{alertDetail}}

If this was you, no action is needed. If it was not, contact us immediately at ${COMPANY.phone} or ${COMPANY.email}.

Review your security settings: {{link}}

— Murivest Group Ltd, ${COMPANY.address}
Manage your notification preferences: {{prefsUrl}}`,
    placeholders: ['firstName', 'alertTitle', 'alertDetail', 'link', 'prefsUrl'],
  },

  platform_notice: {
    key: 'platform_notice',
    category: 'system',
    subject: 'Murivest portal: {{noticeTitle}}',
    preheader: 'An important platform notice from Murivest.',
    bodyHtml: layout({
      preheader: 'An important platform notice from Murivest.',
      heading: '{{noticeTitle}}',
      bodyHtml: para('{{firstName}},') + para('{{noticeBody}}'),
      ctaLabel: 'Open portal',
      ctaUrl: '{{link}}',
      ctaNote: 'Platform notices are rare and limited to material changes that affect your workspace.',
    }),
    bodyText: `{{firstName}},

{{noticeTitle}}

{{noticeBody}}

Open the portal: {{link}}

— Murivest Group Ltd, ${COMPANY.address}
Manage your notification preferences: {{prefsUrl}}`,
    placeholders: ['firstName', 'noticeTitle', 'noticeBody', 'link', 'prefsUrl'],
  },

  weekly_digest: {
    key: 'weekly_digest',
    category: 'system',
    subject: 'Your Murivest portal digest',
    preheader: 'A quiet summary of what moved in your workspace.',
    bodyHtml: layout({
      preheader: 'A quiet summary of what moved in your workspace.',
      heading: 'Your portal digest',
      bodyHtml:
        para('{{firstName}},') +
        para('Since your last digest, {{digestCount}} item{{digestPlural}} were recorded in your workspace.') +
        '{{itemsHtml}}' +
        para('Full detail for every item lives inside your portal.'),
      ctaLabel: 'Open portal',
      ctaUrl: '{{link}}',
      ctaNote: 'Digest frequency and every individual channel can be adjusted in your notification preferences.',
    }),
    bodyText: `{{firstName}},

Since your last digest, {{digestCount}} item{{digestPlural}} were recorded in your workspace.

{{itemsText}}

Open the portal: {{link}}

— Murivest Group Ltd, ${COMPANY.address}
Manage your notification preferences: {{prefsUrl}}`,
    placeholders: ['firstName', 'digestCount', 'digestPlural', 'itemsHtml', 'itemsText', 'link', 'prefsUrl'],
  },
}

export const EMAIL_TEMPLATE_KEYS = Object.keys(EMAIL_TEMPLATES)
