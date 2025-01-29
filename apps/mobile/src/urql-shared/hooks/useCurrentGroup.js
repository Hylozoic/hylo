import { create } from 'zustand'
import { useMemo } from 'react'
import { useQuery } from 'urql'
import useCurrentUser from 'urql-shared/hooks/useCurrentUser'
import groupDetailsQueryMaker from 'graphql/queries/groupDetailsQueryMaker'
import GroupPresenter, { getContextGroup, isContextGroup } from 'urql-shared/presenters/GroupPresenter'

// Zustand store for managing currentGroupSlug
const useCurrentGroupStore = create((set) => ({
  currentGroupSlug: null,
  setCurrentGroupSlug: (slug) => set({ currentGroupSlug: slug })
}))

export function useGroup ({
  groupSlug,
  groupId,
  groupQueryScope = {
    withJoinQuestions: true,
    withPrerequisiteGroups: true
  },
  useQueryArgs = {}
} = {}) {
  const contextGroup = useMemo(() => getContextGroup(groupSlug, groupId), [groupSlug, groupId])
  const pause = contextGroup || useQueryArgs?.pause || (!groupSlug && !groupId)
  const [{ data, fetching, error }, reQuery] = useQuery({
    ...useQueryArgs,
    query: groupDetailsQueryMaker(groupQueryScope),
    variables: { id: groupId, slug: groupSlug },
    pause
  })
  const rawGroup = data?.group || contextGroup
  const group = useMemo(() => rawGroup && GroupPresenter(rawGroup), [rawGroup])

  return [{ group, isContextGroup: !!isContextGroup(groupSlug), fetching, error }, contextGroup ? () => {} : reQuery]
}

export function useCurrentGroupSlug (setToGroupSlug, useQueryArgs = {}) {
  const { currentGroupSlug, setCurrentGroupSlug } = useCurrentGroupStore()
  const [{ currentUser, fetching, error }] = useCurrentUser({ pause: useQueryArgs?.pause || setToGroupSlug || currentGroupSlug })

  // Derive the last viewed group from the user's memberships
  const lastViewedGroup = useMemo(() => {
    if (fetching || !currentUser?.memberships) return null
    const memberships = [...currentUser.memberships]
    memberships.sort((a, b) => new Date(b.lastViewedAt) - new Date(a.lastViewedAt))
    return memberships[0]?.group || null
  }, [currentUser, fetching])

  // Determine the current group slug
  const groupSlug = useMemo(() => {
    if (setToGroupSlug) {
      setCurrentGroupSlug(setToGroupSlug)
      return setToGroupSlug
    }
    if (currentGroupSlug) return currentGroupSlug
    if (lastViewedGroup?.slug) return lastViewedGroup.slug

    return null
  }, [setToGroupSlug, currentGroupSlug, lastViewedGroup])

  return [{ currentGroupSlug: groupSlug, fetching, error }]
}

export default function useCurrentGroup ({
  setToGroupSlug,
  groupQueryScope = {
    withJoinQuestions: true,
    withPrerequisiteGroups: true
  },
  useQueryArgs = {}
} = {}) {
  const [{ currentGroupSlug: groupSlug, fetching: slugFetching, error: slugError }] = useCurrentGroupSlug(setToGroupSlug, useQueryArgs)
  const [{ group, fetching: groupFetching, isContextGroup, error }, reQuery] = useGroup({
    groupSlug,
    groupQueryScope,
    useQueryArgs
  })
  const fetching = slugFetching || groupFetching

  return [{ currentGroup: group, isContextGroup, fetching, error: slugError || error }, reQuery]
}
