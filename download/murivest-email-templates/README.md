# Murivest — Transactional Email Templates (exact)

These are the exact default templates the platform ships with (source of truth:
`src/lib/notifications/email-defaults.ts`). Active rows in `portal.email_templates`
(admin → Notifications → Email templates) override them per key; every edit is
versioned in `portal.email_template_versions`.

## Files

| Template | Category | Subject line | Placeholders |
|---|---|---|---|
| `document_ready.html` | documents | Document ready: {{documentTitle}} | {{firstName}}, {{documentTitle}}, {{documentNote}}, {{link}}, {{prefsUrl}} |
| `new_match.html` | opportunities | New opportunity matching your criteria | {{firstName}}, {{opportunityTitle}}, {{matchNote}}, {{link}}, {{prefsUrl}} |
| `order_confirmation.html` | orders | Order confirmed: {{briefTitle}} ({{orderRef}}) | {{firstName}}, {{briefTitle}}, {{orderRef}}, {{orderScope}}, {{amountLine}}, {{link}}, {{prefsUrl}} |
| `brief_status.html` | orders | Brief update: {{briefTitle}} — {{statusLabel}} | {{firstName}}, {{briefTitle}}, {{orderRef}}, {{statusLabel}}, {{statusNote}}, {{link}}, {{prefsUrl}} |
| `brief_delivered.html` | orders | Brief delivered: {{briefTitle}} ({{orderRef}}) | {{firstName}}, {{briefTitle}}, {{orderRef}}, {{link}}, {{prefsUrl}} |
| `mandate_update.html` | mandates | Mandate update: {{mandateRef}} | {{firstName}}, {{mandateRef}}, {{mandateTitle}}, {{mandateStatus}}, {{mandateNote}}, {{link}}, {{prefsUrl}} |
| `advisor_message.html` | messages | New message from your Murivest advisor | {{firstName}}, {{advisorName}}, {{messagePreview}}, {{link}}, {{prefsUrl}} |
| `security_alert.html` | security | {{alertTitle}} — your Murivest account | {{firstName}}, {{alertTitle}}, {{alertDetail}}, {{link}}, {{prefsUrl}} |
| `platform_notice.html` | system | Murivest portal: {{noticeTitle}} | {{firstName}}, {{noticeTitle}}, {{noticeBody}}, {{link}}, {{prefsUrl}} |
| `weekly_digest.html` | system | Your Murivest portal digest | {{firstName}}, {{digestCount}}, {{digestPlural}}, {{itemsHtml}}, {{itemsText}}, {{link}}, {{prefsUrl}} |

Each `.preview.html` shows the same template with representative values filled
in, for visual review in a browser.

## Design rules (spec §6)

- Clean, institutional, on-brand: deep forest green `#0E2A1C` header, cream
  `#FAF9F6` body, restrained gold `#B8956B` rule — table-based layout with
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
| Forest | `#1B4332` |
| Forest deep | `#0E2A1C` |
| Ivory / cream | `#FAF9F6` |
| Gold | `#B8956B` |
| Body ink | `#33322D` |
| Muted | `#6B6B60` |

Send infrastructure: Murivest's own SMTP (SMTP_HOST / SMTP_PORT / SMTP_USER /
SMTP_PASS / MAIL_FROM env). No third-party mail API is used.
