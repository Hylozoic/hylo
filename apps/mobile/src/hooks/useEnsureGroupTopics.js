import { useEffect } from 'react'
import { useSelector, useDispatch } from 'react-redux'
import fetchGroupTopics from 'store/actions/fetchGroupTopics'
import { FETCH_GROUP_TOPICS } from 'store/constants'
import { getTopicsFromSubscribedGroupTopics } from 'store/selectors/getTopicsFromSubscribedGroupTopics'
import isPendingFor from 'store/selectors/isPendingFor'

export default function useEnsureGroupTopics ({ groupId, groupSlug }) {
  const topics = useSelector(state => getTopicsFromSubscribedGroupTopics(state, { groupId, groupSlug }))
  const pending = useSelector(state => isPendingFor(FETCH_GROUP_TOPICS, state))
  const dispatch = useDispatch()

  useEffect(() => {
    if (!pending && groupId && (!topics || !topics.length > 0)) {
      dispatch(fetchGroupTopics(groupId, { sortBy: 'num_followers', first: 100 }))
    }
  }, [dispatch, groupId, groupSlug])

  return { topics, pending }
}
