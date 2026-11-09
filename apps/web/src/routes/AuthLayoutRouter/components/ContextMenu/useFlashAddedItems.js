import { useEffect, useRef, useState } from 'react'

export const MENU_FLASH_CLASS = 'animate-menu-flash'
const FLASH_MS = 1400

/**
 * Returns ids that just appeared in a menu list so the new row or card can flash.
 * Skips the initial population, bulk loads, and optional view types (e.g. spaces
 * in two-column, where creating a space navigates into it instead).
 */
export default function useFlashAddedItems (items, { skipTypes = [] } = {}) {
  const prevIdsRef = useRef(null)
  const itemsRef = useRef(items)
  itemsRef.current = items
  const [flashingIds, setFlashingIds] = useState(() => new Set())
  const idsKey = (items || []).map(item => item?.id).filter(Boolean).join(',')
  const skipKey = skipTypes.join(',')

  useEffect(() => {
    const current = (itemsRef.current || []).filter(item => item?.id)
    const currentIds = current.map(item => String(item.id))
    if (prevIdsRef.current === null) {
      prevIdsRef.current = new Set(currentIds)
      return
    }

    const skip = new Set(skipKey.split(',').filter(Boolean))
    const added = current
      .filter(item => !prevIdsRef.current.has(String(item.id)))
      .filter(item => !skip.has(item.type))
      .map(item => String(item.id))
    prevIdsRef.current = new Set(currentIds)
    // One or two new items is an add; a larger burst is the list loading in.
    if (added.length === 0 || added.length > 2) return

    setFlashingIds(prev => {
      const next = new Set(prev)
      added.forEach(id => next.add(id))
      return next
    })

    requestAnimationFrame(() => {
      const el = document.querySelector(`[data-menu-flash="${added[0]}"]`)
      el?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    })

    const timeout = setTimeout(() => {
      setFlashingIds(prev => {
        const next = new Set(prev)
        added.forEach(id => next.delete(id))
        return next
      })
    }, FLASH_MS)
    return () => clearTimeout(timeout)
  }, [idsKey, skipKey])

  return flashingIds
}
