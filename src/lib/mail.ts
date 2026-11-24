import nodemailer, {type Transporter} from 'nodemailer'
/**
 * Transactional email delivery — over Murivest's own SMTP server.
 *
 * Configure with the credentials you already own:
 *   SMTP_HOST   e.g. smtp.murivest.com or your provider's host
 *   SMTP_PORT   587 (STARTTLS) or 465 (implicit TLS)
 *   SMTP_SECURE 'true' | 'false' | leave unset to auto-detect from the port
 *   SMTP_USER   mailbox username
 *   SMTP_PASS   mailbox password / app password
 *   SENDER_NAME sender display name, e.g. "Murivest Group Ltd" (defaults to
 *              "Murivest Group Ltd") — used when SMTP_FROM is not set
 *   MAIL_FROM   visible From header, e.g. "Murivest <no-reply@murivest.com>"
 *
 * No third-party API (Resend or otherwise) is used. Credentials are only
 * read from the environment, are never logged, and the transporter is
 * cached per process.
 *
 * Until SMTP is configured, mail is logged server-side only. When the
 * explicit ALLOW_DEV_AUTH_LINKS flag is set (non-production), auth links
 * are also returned to the caller so the journey remains testable before
 * SMTP is provisioned. The flag must NEVER be enabled in production.
 */

export interface MailMessage {
  to: string
  subject: string
  text: string
  html?: string
}

const FROM = process.env.SMTP_FROM || `${process.env.SENDER_NAME || 'Murivest Group Ltd'} <${process.env.SMTP_USER || 'no-reply@murivest.com'}>`

function smtpConfigured(): boolean {
  return Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS)
}

function resolveSecure(): boolean {
  const raw = process.env.SMTP_SECURE?.trim().toLowerCase()
  if (raw === 'true') return true
  if (raw === 'false') return false
  // Auto: implicit TLS on 465, STARTTLS negotiation on every other port.
  const port = Number.parseInt(process.env.SMTP_PORT || '587', 10)
  return port === 465
}

let cachedTransporter: Transporter | null = null

function getTransporter(): Transporter {
  if (!cachedTransporter) {
    cachedTransporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number.parseInt(process.env.SMTP_PORT || '587', 10),
      secure: resolveSecure(),
      auth: {user: process.env.SMTP_USER, pass: process.env.SMTP_PASS},
      // Institutional hygiene: fail fast rather than silently downgrading.
      requireTLS: resolveSecure() ? undefined : true,
    })
  }
  return cachedTransporter
}

export async function sendMail(message: MailMessage): Promise<{delivered: boolean; messageId?: string; error?: string; bounced?: boolean; devLink?: string}> {
  if (!smtpConfigured()) {
    console.info(`[mail:not-configured] to=${message.to} subject="${message.subject}"\n${message.text}`)
    return {delivered: false, devLink: devLinkFrom(message.text)}
  }
  try {
    const transporter = getTransporter()
    const info = await transporter.sendMail({
      from: FROM,
      to: message.to,
      subject: message.subject,
      text: message.text,
      html: message.html,
    })
    return {delivered: true, messageId: info.messageId}
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err)
    const bounced = /bounced|recipient address rejected|user unknown|no such user|550|551|553/i.test(error)
    console.error('[mail:error]', error)
    return {delivered: false, error: error.slice(0, 300), ...(bounced ? {bounced: true} : {})}
  }
}

function devLinkFrom(text: string): string | undefined {
  if (process.env.ALLOW_DEV_AUTH_LINKS !== 'true' || process.env.NODE_ENV === 'production') return undefined
  const m = text.match(/https?:\/\/\S+token=\S+/)
  return m ? m[0] : undefined
}
