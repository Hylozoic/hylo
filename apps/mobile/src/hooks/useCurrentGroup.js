import { useMemo } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { useQuery } from 'urql'
import useCurrentUser from 'hooks/useCurrentUser'
import groupDetailsQueryMaker from 'graphql/queries/groupDetailsQueryMaker'
import { SET_CURRENT_GROUP_SLUG } from 'store/constants'
import GroupPresenter, {
  ALL_GROUP,
  ALL_GROUP_ID,
  PUBLIC_GROUP,
  PUBLIC_GROUP_ID,
  MY_CONTEXT_GROUP,
  MY_CONTEXT_ID
} from 'urql-shared/presenters/GroupPresenter'

export function useGroup ({
  groupSlug,
  groupId,
  groupQueryScope = {
    withJoinQuestions: true,
    withPrerequisiteGroups: true
  },
  useQueryArgs = {}
} = {}) {
  const contextGroup = useMemo(() => {
    if (groupId === ALL_GROUP_ID || groupSlug === ALL_GROUP_ID) return ALL_GROUP
    if (groupId === PUBLIC_GROUP_ID || groupSlug === PUBLIC_GROUP_ID) return PUBLIC_GROUP
    if (groupId === MY_CONTEXT_ID || groupSlug === MY_CONTEXT_ID) return MY_CONTEXT_GROUP

    return null
  }, [groupId, groupSlug])

  const [{ data, fetching, error }, reQuery] = useQuery({
    ...useQueryArgs,
    query: groupDetailsQueryMaker(groupQueryScope),
    variables: { id: groupId, slug: groupSlug },
    pause: useQueryArgs?.pause || (!groupSlug && !groupId)
  })

  const group = useMemo(() => {
    if (contextGroup) return contextGroup
    if (data?.group) return GroupPresenter(data.group)

    return null
  }, [contextGroup, data])

  return [group, { fetching, error }, reQuery]
}
// TODO: URQL delete store/actions/setCurrentGroupSlug.js (after Sockets conversion)
export function setCurrentGroupSlug (groupSlug) {
  return {
    type: SET_CURRENT_GROUP_SLUG,
    payload: groupSlug
  }
}

export function useCurrentGroupSlug (setToGroupSlug, useQueryArgs = {}) {
  const dispatch = useDispatch()

  const savedCurrentGroupSlug = useSelector(state => state.session?.groupSlug)

  const [currentUser, { fetching, error }] = useCurrentUser({ pause: useQueryArgs?.pause || setToGroupSlug || savedCurrentGroupSlug })

  const lastViewedGroup = useMemo(() => {
    if (fetching || !currentUser?.memberships) return null
    const memberships = [...currentUser.memberships]
    memberships.sort((a, b) => new Date(b.lastViewedAt) - new Date(a.lastViewedAt))
    return memberships[0]?.group || null
  }, [currentUser, fetching])

  const groupSlug = useMemo(() => {
    if (setToGroupSlug) {
      dispatch(setCurrentGroupSlug(setToGroupSlug))
      return setToGroupSlug
    }
    if (savedCurrentGroupSlug) return savedCurrentGroupSlug
    if (lastViewedGroup?.slug) return lastViewedGroup.slug

    return null
  }, [setToGroupSlug, savedCurrentGroupSlug, lastViewedGroup])

  return [groupSlug, { fetching, error }]
}

export default function useCurrentGroup ({
  setToGroupSlug,
  groupQueryScope = {
    withJoinQuestions: true,
    withPrerequisiteGroups: true
  },
  useQueryArgs = {}
} = {}) {
  const [groupSlug, { fetching: slugFetching, error: slugError }] = useCurrentGroupSlug(setToGroupSlug, useQueryArgs)
  const [group, { fetching: groupFetching, error }, reQuery] = useGroup({
    groupSlug,
    groupQueryScope,
    useQueryArgs
  })
  const fetching = slugFetching || groupFetching

  return [group, { fetching, error: slugError || error }, reQuery]
}
