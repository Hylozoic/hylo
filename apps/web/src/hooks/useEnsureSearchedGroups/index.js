import { useEffect } from 'react'
import { fetchGroups, getGroups, getGroupQueryProps, getHasMoreGroups } from 'store/actions/fetchGroups'
import { useSelector, useDispatch } from 'react-redux'
import isPendingFor from 'store/selectors/isPendingFor'
import { FETCH_GROUPS, SORT_NEAREST } from 'store/constants'

export default function useEnsureSearchedGroups ({ sortBy, search, offset, nearCoord, visibility, groupType, farmQuery }) {
  const useNearCoord = sortBy === SORT_NEAREST ? nearCoord : null
  const queryProps = getGroupQueryProps({ sortBy, search, nearCoord: useNearCoord, groupType, farmQuery })
  const groups = useSelector(state => getGroups(state, queryProps))
  const pending = useSelector(state => isPendingFor(FETCH_GROUPS, state))
  const hasMore = useSelector(state => getHasMoreGroups(state, queryProps))
  const dispatch = useDispatch()

  useEffect(() => {
    dispatch(fetchGroups({ sortBy, search, offset: 0, nearCoord: useNearCoord, visibility, groupType, farmQuery, allowedInPublic: true }))
  }, [dispatch, search, sortBy, groupType, farmQuery])

  const fetchMoreGroups = (offset) => {
    if (pending || groups.length === 0 || !hasMore) return
    dispatch(fetchGroups({ sortBy, search, offset, nearCoord: useNearCoord, visibility, groupType, farmQuery, allowedInPublic: true }))
  }

  return { groups, pending, hasMore, fetchMoreGroups }
}
