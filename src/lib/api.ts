import {NextResponse, type NextRequest} from 'next/server'
import type {ZodType} from 'zod'
import {toIpString, userAgentOf} from '@/lib/auth/request-meta'

/**
 * Route-handler helpers: uniform JSON errors, zod parsing, client metadata.
 */

export function ok(data: Record<string, unknown> = {}) {
  return NextResponse.json({ok: true, ...data})
}

export function fail(message: string, status = 400, extra: Record<string, unknown> = {}) {
  return NextResponse.json({ok: false, error: message, ...extra}, {status})
}

export async function parseBody<T>(req: NextRequest, schema: ZodType<T>): Promise<{data: T} | {response: NextResponse}> {
  let raw: unknown
  try {
    raw = await req.json()
  } catch {
    return {response: fail('Invalid request body.')}
  }
  const parsed = schema.safeParse(raw)
  if (!parsed.success) {
    return {response: fail(parsed.error.issues[0]?.message || 'Validation failed.')}
  }
  return {data: parsed.data}
}

export function clientMeta(req: NextRequest) {
  return {ip: toIpString(req), userAgent: userAgentOf(req)}
}
