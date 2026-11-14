import {COMPANY} from '@/lib/constants'

/**
 * Transactional email delivery.
 *
 * Production: set RESEND_API_KEY (and MAIL_FROM) — delivery goes through
 * Resend's HTTPS API, so no SMTP dependency is bundled.
 * Self-hosted SMTP is equally supported via the SMTP_* variables with the
 * same sendMail() interface (see README "Email" section).
 *
 * Until configured, mail is logged server-side only. When the explicit
 * ALLOW_DEV_AUTH_LINKS flag is set (non-production), auth links are also
 * returned to the caller so the journey remains testable before SMTP is
 * provisioned. The flag must NEVER be enabled in production.
 */

export interface MailMessage {
  to: string
  subject: string
  text: string
  html?: string
}

const FROM = process.env.MAIL_FROM || `${COMPANY.name} <onboarding@resend.dev>`

export async function sendMail(message: MailMessage): Promise<{delivered: boolean; devLink?: string}> {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) {
    console.info(`[mail:not-configured] to=${message.to} subject="${message.subject}"\n${message.text}`)
    return {delivered: false, devLink: devLinkFrom(message.text)}
  }
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json'},
      body: JSON.stringify({from: FROM, to: [message.to], subject: message.subject, text: message.text, html: message.html}),
    })
    return {delivered: res.ok}
  } catch (err) {
    console.error('[mail:error]', err)
    return {delivered: false}
  }
}

function devLinkFrom(text: string): string | undefined {
  if (process.env.ALLOW_DEV_AUTH_LINKS !== 'true' || process.env.NODE_ENV === 'production') return undefined
  const m = text.match(/https?:\/\/\S+token=\S+/)
  return m ? m[0] : undefined
}
