import {NextResponse, type NextRequest} from 'next/server'
import {supabase, unwrap, unwrapNullable} from '@/lib/supabase'
import {forgotPasswordSchema, resetPasswordSchema, passwordChangeSchema} from '@/lib/validation'
import {hashPassword, verifyPassword} from '@/lib/auth/password'
import {issueAuthToken, consumeAuthToken} from '@/lib/auth/tokens'
import {revokeAllSessions} from '@/lib/auth/login'
import {sendMail} from '@/lib/mail'
import {audit, securityEvent} from '@/lib/auth/audit'
import {parseBody, ok, fail, clientMeta} from '@/lib/api'
import {requireApiUser, isResponse} from '@/lib/auth/context'
import {COMPANY} from '@/lib/constants'
import type {UserRow} from '@/lib/db-types'

/**
 * POST /api/auth/password
 *   {action: 'forgot', email}
 *   {action: 'reset', token, password}
 *   {action: 'change', currentPassword, newPassword}   (authenticated)
 */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null)
  const action = (body as {action?: string} | null)?.action
  const meta = clientMeta(req)

  if (action === 'forgot') {
    const parsed = forgotPasswordSchema.safeParse(body)
    if (!parsed.success) return fail(parsed.error.issues[0]?.message || 'Enter a valid email.')
    const userRow = unwrapNullable<UserRow>(
      await supabase.from('users').select('*').eq('email', parsed.data.email).maybeSingle(),
      'user.byEmail',
    )
    if (userRow && userRow.status === 'active') {
      const token = await issueAuthToken(userRow.id, 'password_reset')
      const url = `${(process.env.NEXT_PUBLIC_SITE_URL || COMPANY.siteUrl).replace(/\/$/, '')}/reset-password?token=${encodeURIComponent(token)}`
      const mail = await sendMail({
        to: parsed.data.email,
        subject: 'Reset your Murivest password',
        text: `A password reset was requested for your account.\n\n${url}\n\nThe link expires in 30 minutes. If you did not request this, ignore this email — your password remains unchanged.\n\n${COMPANY.legalName}`,
      })
      const res: Record<string, unknown> = {ok: true, message: 'If that address is registered, reset instructions have been sent.'}
      if (mail.devLink) res.devLink = mail.devLink
      return NextResponse.json(res)
    }
    return ok({message: 'If that address is registered, reset instructions have been sent.'})
  }

  if (action === 'reset') {
    const parsed = resetPasswordSchema.safeParse(body)
    if (!parsed.success) return fail(parsed.error.issues[0]?.message || 'Invalid reset request.')
    const userId = await consumeAuthToken(parsed.data.token, 'password_reset')
    if (!userId) return fail('This reset link is invalid or has expired. Request a new one.', 401)
    const passwordHash = await hashPassword(parsed.data.password)
    unwrap<null>(
      await supabase
        .from('users')
        .update({password_hash: passwordHash, failed_logins: 0, locked_until: null})
        .eq('id', userId),
      'user.resetPassword',
    )
    await revokeAllSessions(userId) // every device signs out after a reset
    await securityEvent({userId, type: 'password_changed', ...meta})
    await audit({actorId: userId, action: 'auth.password_reset', ...meta})
    return ok()
  }

  if (action === 'change') {
    const guard = await requireApiUser()
    if (isResponse(guard)) return guard.response
    const {ctx} = guard
    const parsed = passwordChangeSchema.safeParse(body)
    if (!parsed.success) return fail(parsed.error.issues[0]?.message || 'Invalid request.')
    const valid = await verifyPassword(parsed.data.currentPassword, ctx.user.passwordHash)
    if (!valid) return fail('Current password is incorrect.', 401)
    const passwordHash = await hashPassword(parsed.data.newPassword)
    unwrap<null>(
      await supabase.from('users').update({password_hash: passwordHash}).eq('id', ctx.user.id),
      'user.changePassword',
    )
    await securityEvent({userId: ctx.user.id, type: 'password_changed', ...meta})
    await audit({actorId: ctx.user.id, action: 'auth.password_changed', ...meta})
    return ok()
  }

  return fail('Unknown action.')
}
