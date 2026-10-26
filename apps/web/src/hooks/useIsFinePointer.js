import { useState, useEffect } from 'react'

export const FINE_POINTER_MEDIA_QUERY = '(hover: hover) and (pointer: fine)'

function matchesFinePointer () {
  return typeof window !== 'undefined' && !!window.matchMedia?.(FINE_POINTER_MEDIA_QUERY)?.matches
}

// True on devices with a mouse or trackpad, false on touch-first devices.
// Use it for controls that only make sense without an on-screen keyboard (e.g. an emoji button).
export default function useIsFinePointer () {
  const [isFinePointer, setIsFinePointer] = useState(matchesFinePointer)
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return
    const mq = window.matchMedia(FINE_POINTER_MEDIA_QUERY)
    if (!mq?.addEventListener) return
    const handler = (e) => setIsFinePointer(e.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])
  return isFinePointer
}
