import { useCallback, useEffect, useRef, useState } from 'react'
import { mergeIds, pageHasMore, personFromResult } from './profilePaging'
import useScrollSentinel from './useScrollSentinel'

// Loads successive pages of one profile collection and asks for the next page at the bottom of the scroll column.
export default function usePagedProfileList ({ personId, pageSize = 20, requestPage, readSet }) {
  const [ids, setIds] = useState([])
  const [hasMore, setHasMore] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [settled, setSettled] = useState(false)
  const idsRef = useRef([])
  const offsetRef = useRef(0)
  const hasMoreRef = useRef(false)
  const loadingRef = useRef(false)
  const readSetRef = useRef(readSet)
  readSetRef.current = readSet

  const applyPage = useCallback((person, replace) => {
    const querySet = readSetRef.current(person)
    const merged = mergeIds(replace ? [] : idsRef.current, querySet && querySet.items)
    idsRef.current = merged.ids
    setIds(merged.ids)
    const more = pageHasMore(querySet, merged.added, pageSize)
    hasMoreRef.current = more
    setHasMore(more)
  }, [pageSize])

  useEffect(() => {
    if (!personId) return undefined
    let cancelled = false
    idsRef.current = []
    offsetRef.current = 0
    hasMoreRef.current = false
    loadingRef.current = false
    setIds([])
    setHasMore(false)
    setLoadingMore(false)
    setSettled(false)
    requestPage(0).then(result => {
      if (cancelled) return
      applyPage(personFromResult(result), true)
      setSettled(true)
    }).catch(() => {
      if (cancelled) return
      hasMoreRef.current = false
      setHasMore(false)
      setSettled(true)
    })
    return () => { cancelled = true }
  }, [personId, requestPage, applyPage])

  const loadMore = useCallback(async () => {
    if (loadingRef.current || !hasMoreRef.current) return
    loadingRef.current = true
    setLoadingMore(true)
    offsetRef.current += pageSize
    try {
      const result = await requestPage(offsetRef.current)
      applyPage(personFromResult(result), false)
    } catch {
      hasMoreRef.current = false
      setHasMore(false)
    } finally {
      loadingRef.current = false
      setLoadingMore(false)
    }
  }, [applyPage, pageSize, requestPage])

  const sentinelRef = useScrollSentinel(settled && hasMore && !loadingMore, loadMore, ids.length)

  return { ids, hasMore, loadingMore, settled, sentinelRef }
}
