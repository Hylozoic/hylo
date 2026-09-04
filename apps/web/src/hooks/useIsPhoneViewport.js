import { useState, useEffect } from 'react'

// Tracks whether the viewport is at or below the Tailwind 'sm' breakpoint (639px).
// Used to switch between phone-only and desktop layouts that aren't expressible with
// pure CSS alone (e.g., master-detail navigation, conditional component mounts).
export default function useIsPhoneViewport () {
  const [isPhoneViewport, setIsPhoneViewport] = useState(() =>
    typeof window !== 'undefined' && window.matchMedia('(max-width: 639px)').matches
  )
  useEffect(() => {
    if (typeof window === 'undefined') return
    const mq = window.matchMedia('(max-width: 639px)')
    const handler = (e) => setIsPhoneViewport(e.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])
  return isPhoneViewport
}
