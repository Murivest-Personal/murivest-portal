'use client'

/**
 * Shared admin client helpers — thin fetch wrappers with uniform error
 * handling. All calls are same-origin; the session cookie rides along.
 */

export async function adminAction(action: string, payload: Record<string, unknown> = {}): Promise<{ok: boolean; error?: string} & Record<string, unknown>> {
  try {
    const res = await fetch('/api/admin/action', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({action, payload}),
    })
    const data = await res.json().catch(() => ({ok: false, error: 'Unexpected response.'}))
    if (!res.ok) return {ok: false, error: data.error || `Request failed (${res.status}).`}
    return data
  } catch {
    return {ok: false, error: 'Network error — please retry.'}
  }
}

export async function adminData<T = Record<string, unknown>>(scope: string, params: Record<string, string> = {}): Promise<{ok: boolean; error?: string; data?: T}> {
  try {
    const qs = new URLSearchParams({scope, ...params}).toString()
    const res = await fetch(`/api/admin/data?${qs}`, {cache: 'no-store'})
    const data = await res.json().catch(() => ({ok: false, error: 'Unexpected response.'}))
    if (!res.ok || data.ok === false) return {ok: false, error: data.error || `Request failed (${res.status}).`}
    return {ok: true, data: data as T}
  } catch {
    return {ok: false, error: 'Network error — please retry.'}
  }
}

export const inputClass =
  'w-full border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-gold focus:outline-none'
export const labelClass = 'mb-1.5 block text-[10px] font-medium uppercase tracking-[0.16em] text-muted-foreground'
