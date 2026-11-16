'use client'

import {useState} from 'react'
import {useRouter} from 'next/navigation'
import {Loader2, Send} from 'lucide-react'

const input =
  'w-full rounded-standard border border-border bg-background px-4 py-2.5 text-sm text-foreground focus:border-primary'

/** Inline enquiry form — posts to the Murivest desk with opportunity context. */
export default function EnquiryForm({
  sanityOpportunityId,
  opportunityTitle,
  compact,
}: {
  sanityOpportunityId?: string
  opportunityTitle?: string
  compact?: boolean
}) {
  const router = useRouter()
  const [subject, setSubject] = useState(opportunityTitle ? `${opportunityTitle.slice(0, 140)} — enquiry` : '')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [sent, setSent] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (subject.trim().length < 3 || message.trim().length < 10) {
      setError('Add a subject and a message (10+ characters).')
      return
    }
    setError('')
    setBusy(true)
    try {
      const res = await fetch('/api/enquiries', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({subject, message, sanityOpportunityId, opportunityTitle}),
      })
      const data = await res.json()
      if (!res.ok || data.error) {
        setError(data.error || 'Could not send the enquiry.')
        return
      }
      setSent(true)
      setMessage('')
      router.refresh()
    } catch {
      setError('Network error — please try again.')
    } finally {
      setBusy(false)
    }
  }

  if (sent) {
    return (
      <div className="border-l-2 border-gold bg-gold/5 px-4 py-3 text-xs leading-relaxed text-primary">
        Enquiry sent. Your advisor responds within the thread — see Activity &amp; Communications.
      </div>
    )
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <div>
        <label className="mb-1.5 block text-[10px] font-medium uppercase tracking-[0.16em] text-muted-foreground" htmlFor="enq-subject">
          Subject
        </label>
        <input id="enq-subject" className={input} value={subject} maxLength={200} onChange={(e) => setSubject(e.target.value)} placeholder="e.g. Westlands office — data room access" />
      </div>
      <div>
        <label className="mb-1.5 block text-[10px] font-medium uppercase tracking-[0.16em] text-muted-foreground" htmlFor="enq-message">
          Message
        </label>
        <textarea id="enq-message" className={`${input} min-h-24 ${compact ? '' : 'min-h-32'}`} value={message} maxLength={4000} onChange={(e) => setMessage(e.target.value)} placeholder="Maturity of interest, questions, information requests…" />
      </div>
      {error ? <div className="border-l-2 border-destructive bg-red-50 px-4 py-2 text-xs text-destructive">{error}</div> : null}
      <button
        type="submit"
        disabled={busy}
        className="inline-flex items-center gap-2 bg-primary px-5 py-2.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-primary-foreground transition-colors hover:bg-forest-deep disabled:opacity-60"
      >
        {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
        Send enquiry
      </button>
    </form>
  )
}
