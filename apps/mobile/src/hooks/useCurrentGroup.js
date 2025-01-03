import { useMemo } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { useQuery } from 'urql'
import setCurrentGroupSlug from 'store/actions/setCurrentGroupSlug'
import getCurrentGroupSlug from 'store/selectors/getCurrentGroupSlug'
import useCurrentUser from 'hooks/useCurrentUser'
import groupDetailsQueryMaker from 'graphql/queries/groupDetailsQueryMaker'
import GroupPresenter, {
  ALL_GROUP, ALL_GROUP_ID,
  PUBLIC_GROUP, PUBLIC_GROUP_ID,
  MY_CONTEXT_GROUP, MY_CONTEXT_ID
} from 'urql-shared/presenters/GroupPresenter'

export default function useCurrentGroup ({
  setToGroupSlug,
  groupQueryScope = {
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
  groupQueryScope = {},
  useQueryArgs = {}
} = {}) {
  let group
  // NOTE: currently not using id lookup
  const id = null

  if (id === ALL_GROUP_ID || groupSlug === ALL_GROUP_ID) {
    group = ALL_GROUP
  } else if (id === PUBLIC_GROUP_ID || groupSlug === PUBLIC_GROUP_ID) {
    group = PUBLIC_GROUP
  } else if (id === MY_CONTEXT_ID || groupSlug === MY_CONTEXT_ID) {
    group = MY_CONTEXT_GROUP
  }

  const [{ data, fetching, error }, reQuery] = useQuery({
    ...useQueryArgs,
    query: groupDetailsQueryMaker(groupQueryScope),
    variables: { id, slug: groupSlug },
    pause: group || useQueryArgs?.pause
  })

  group = useMemo(() => group || GroupPresenter(data?.group), [group, data?.group])

  return [group, { fetching, error }, reQuery]
}

export function useCurrentGroupSlug (setToGroupSlug) {
  const dispatch = useDispatch()
  const savedCurrentGroupSlug = useSelector(getCurrentGroupSlug)

  const [currentUser] = useCurrentUser()
  // Sort memberships by lastViewedAt in descending order
  const sortedMemberships = useMemo(() => [...currentUser.memberships].sort((a, b) =>
    new Date(b.lastViewedAt) - new Date(a.lastViewedAt)
  ), [currentUser.memberships])
  // Get the first (latest) membership and return its group
  const lastViewedGroup = sortedMemberships[0] ? sortedMemberships[0]?.group : null

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
