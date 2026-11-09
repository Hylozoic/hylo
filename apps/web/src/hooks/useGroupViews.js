import { useMemo } from 'react'
import { useSelector } from 'react-redux'

import { makeGetGroupViews } from 'store/selectors/getGroupViews'

const EMPTY_VIEWS = []

/**
 * Ordered GroupView items for a group, read through a selector instance private to the
 * calling component. Components that render one instance per group need that: redux-orm
 * caches a single result per selector, so siblings holding different groups evict each
 * other and hand back a new array every render. Returns a stable [] when there is no group.
 */
export default function useGroupViews (group) {
  const getGroupViews = useMemo(() => makeGetGroupViews(), [])

  return useSelector(state => group?.id ? getGroupViews(state, group) : EMPTY_VIEWS)
}
