import { useMemo } from 'react'
import { useSelector } from 'react-redux'

import { makeGetMoreSpacesSections } from 'store/selectors/getMoreSpacesSections'

// Same shape the selector returns for a missing group, hoisted so the no-group branch
// keeps a stable reference across calls.
const EMPTY_SECTIONS = {
  trackSpaces: [],
  fundingRoundSpaces: [],
  otherSpaces: [],
  archivedSpaces: [],
  hasAny: false
}

/**
 * More Spaces sections for a group, read through a selector instance private to the
 * calling component — see useGroupViews for why the shared selector is not enough.
 */
export default function useMoreSpacesSections (group) {
  const getMoreSpacesSections = useMemo(() => makeGetMoreSpacesSections(), [])

  return useSelector(state => group ? getMoreSpacesSections(state, group) : EMPTY_SECTIONS)
}
