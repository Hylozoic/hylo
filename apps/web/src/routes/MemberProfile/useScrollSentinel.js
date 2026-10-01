import { useEffect, useRef } from 'react'

function scrollParent (element) {
  let parent = element.parentElement
  while (parent) {
    const overflowY = window.getComputedStyle(parent).overflowY
    if (overflowY === 'auto' || overflowY === 'scroll') return parent
    parent = parent.parentElement
  }
  return null
}

// Fires onLoadMore when the sentinel scrolls into the profile column.
export default function useScrollSentinel (enabled, onLoadMore, resetKey) {
  const ref = useRef(null)
  const onLoadMoreRef = useRef(onLoadMore)
  onLoadMoreRef.current = onLoadMore

  useEffect(() => {
    if (!enabled) return undefined
    if (typeof window === 'undefined' || !window.IntersectionObserver) return undefined
    const el = ref.current
    if (!el) return undefined
    const observer = new window.IntersectionObserver(entries => {
      if (entries[0] && entries[0].isIntersecting) onLoadMoreRef.current()
    }, { root: scrollParent(el), rootMargin: '240px' })
    observer.observe(el)
    return () => observer.disconnect()
  }, [enabled, resetKey])

  return ref
}
