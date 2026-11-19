'use client'

import {useState} from 'react'
import {useRouter} from 'next/navigation'
import {Bookmark, BookmarkCheck, Loader2} from 'lucide-react'
import {cn} from '@/lib/utils'

export default function SaveButton({
  sanityId,
  initialSaved,
  compact,
  onToggle,
}: {
  sanityId: string
  initialSaved: boolean
  compact?: boolean
  onToggle?: (saved: boolean) => void
}) {
  const router = useRouter()
  const [saved, setSaved] = useState(initialSaved)
  const [busy, setBusy] = useState(false)

  async function toggle() {
    setBusy(true)
    try {
      const res = await fetch('/api/saved-opportunities', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({sanityId}),
      })
      const data = await res.json()
      if (res.ok) {
        const newSaved = !!data.saved
        setSaved(newSaved)
        onToggle?.(newSaved)
      }
      router.refresh()
    } catch {
      /* keep prior state */
    } finally {
      setBusy(false)
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={busy}
      aria-pressed={saved}
      aria-label={saved ? 'Remove from saved opportunities' : 'Save opportunity'}
      className={cn(
        'press-scale rounded-standard inline-flex items-center gap-2 border px-4 py-2 text-[11px] font-medium uppercase tracking-[0.12em] transition-colors',
        saved ? 'border-gold bg-gold/10 text-primary' : 'border-border text-primary hover:border-gold hover:text-gold',
        compact && 'px-2.5 py-1.5',
      )}
    >
      {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : saved ? <BookmarkCheck className="h-3.5 w-3.5 text-gold" /> : <Bookmark className="h-3.5 w-3.5" />}
      {!compact && (saved ? 'Saved' : 'Save')}
    </button>
  )
}
