'use client'

import {useEffect, useRef} from 'react'

/** Records an authorised view (feeds the high-interest signal). */
export default function ViewTracker({sanityId}: {sanityId: string}) {
  const fired = useRef(false)
  useEffect(() => {
    if (fired.current) return
    fired.current = true
    fetch('/api/opportunity-views', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({sanityId}),
    }).catch(() => {})
  }, [sanityId])
  return null
}
