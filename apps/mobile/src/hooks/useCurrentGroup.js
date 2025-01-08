import { useMemo } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { useQuery } from 'urql'
import useCurrentUser from 'hooks/useCurrentUser'
import groupDetailsQueryMaker from 'graphql/queries/groupDetailsQueryMaker'
import GroupPresenter, {
  ALL_GROUP, ALL_GROUP_ID,
  PUBLIC_GROUP, PUBLIC_GROUP_ID,
  MY_CONTEXT_GROUP, MY_CONTEXT_ID
} from 'urql-shared/presenters/GroupPresenter'
import { SET_CURRENT_GROUP_SLUG } from 'store/constants'

export default function useCurrentGroup ({
  setToGroupSlug,
  groupQueryScope = {
    withContextWidgets: true,
    withJoinQuestions: true,
    withPrerequisiteGroups: true
  },
  useQueryArgs = {}
} = {}) {
  const currentGroupSlug = useCurrentGroupSlug(setToGroupSlug)
  const groupDetailsResponse = useGroup({
    groupSlug: currentGroupSlug,
    groupQueryScope,
    useQueryArgs
  })

  return groupDetailsResponse
}

export function useGroup ({
  groupSlug,
  groupId,
  groupQueryScope = {},
  useQueryArgs = {}
} = {}) {
  let group

  if (groupId === ALL_GROUP_ID || groupSlug === ALL_GROUP_ID) {
    group = ALL_GROUP
  } else if (groupId === PUBLIC_GROUP_ID || groupSlug === PUBLIC_GROUP_ID) {
    group = PUBLIC_GROUP
  } else if (groupId === MY_CONTEXT_ID || groupSlug === MY_CONTEXT_ID) {
    group = MY_CONTEXT_GROUP
  }

  const [{ data, fetching, error }, reQuery] = useQuery({
    ...useQueryArgs,
    query: groupDetailsQueryMaker(groupQueryScope),
    variables: { id: groupId, slug: groupSlug },
    pause: group || useQueryArgs?.pause
  })

  group = useMemo(() => group || GroupPresenter(data?.group), [group, data?.group])

  return [group, { fetching, error }, reQuery]
}

// TODO: URQL delete store/actions/setCurrentGroupSlug.js (after Sockets conversion)
export function setCurrentGroupSlug (groupSlug) {
  return {
    type: SET_CURRENT_GROUP_SLUG,
    payload: groupSlug
  }
}

export function useLastViewedGroup () {
  const [currentUser] = useCurrentUser()
  // Sort memberships by lastViewedAt in descending order
  const sortedMemberships = useMemo(() => [...currentUser.memberships].sort((a, b) =>
    new Date(b.lastViewedAt) - new Date(a.lastViewedAt)
  ), [currentUser.memberships])
  // Get the first (latest) membership and return its group
  return sortedMemberships[0] ? sortedMemberships[0]?.group : null
}

export function useCurrentGroupSlug (setToGroupSlug) {
  const dispatch = useDispatch()
  // TODO: URQL delete store/selectors/getCurrentGroup.js (after Sockets conversion)
  const savedCurrentGroupSlug = useSelector(state => state.session?.groupSlug)
  const lastViewedGroup = useLastViewedGroup()

  let currentGroupSlug
  // Group slug specified in the route (so navigated here)
  if (setToGroupSlug) {
    dispatch(setCurrentGroupSlug(setToGroupSlug))
    currentGroupSlug = setToGroupSlug
  // A stored currentGroupSlug
  } else if (savedCurrentGroupSlug) {
    currentGroupSlug = savedCurrentGroupSlug
  // The lastViewedGroup
  } else {
    dispatch(setCurrentGroupSlug(lastViewedGroup?.slug))
    currentGroupSlug = lastViewedGroup?.slug
  }

  return currentGroupSlug
}
