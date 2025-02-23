import { useMemo, useEffect } from 'react'
import { useQuery } from 'urql'
import { useTranslation } from 'react-i18next'
import { create } from 'zustand'
import { PUBLIC_CONTEXT_SLUG, MY_CONTEXT_SLUG } from '@hylo/shared'
import mixpanel from 'services/mixpanel'
import useCurrentUser from './useCurrentUser'
import groupDetailsQueryMaker from '@hylo/graphql/queries/groupDetailsQueryMaker'
import GroupPresenter, { getContextGroup, isContextGroupSlug } from '@hylo/presenters/GroupPresenter'

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
  const { t } = useTranslation()
  const [{ currentUser, fetching: userFetching, error: userError }] = useCurrentUser({ pause: useQueryArgs?.pause || !groupSlug })
  const contextGroup = useMemo(() => getContextGroup(groupSlug || groupId, { currentUser, t }), [groupSlug, groupId])

  const pause = !!contextGroup || useQueryArgs?.pause || (!groupSlug && !groupId)
  const [{ data, fetching: groupFetching, error: groupError }, reQuery] = useQuery({
    ...useQueryArgs,
    query: groupDetailsQueryMaker(groupQueryScope),
    variables: { id: groupId, slug: groupSlug },
    pause
  })

  const group = contextGroup || GroupPresenter(data?.group, { currentUser })

  return [{ group, isContextGroupSlug: !!isContextGroupSlug(groupSlug), fetching: userFetching || groupFetching, error: groupError || userError }, contextGroup ? () => {} : reQuery]
}

export function useContextGroups () {
  const { t } = useTranslation()
  const [{ currentUser }] = useCurrentUser()

  return {
    myContext: getContextGroup(MY_CONTEXT_SLUG, { currentUser, t }),
    publicContext: getContextGroup(PUBLIC_CONTEXT_SLUG, { currentUser, t })
  }
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

  return [{ currentGroupSlug: groupSlug, setCurrentGroupSlug, fetching, error }]
}

export default function useCurrentGroup ({
  setToGroupSlug,
  groupQueryScope = {
    withJoinQuestions: true,
    withPrerequisiteGroups: true,
    withContextWidgets: true
  },
  useQueryArgs = {}
} = {}) {
  const [{ currentGroupSlug: groupSlug, fetching: slugFetching, error: slugError }] = useCurrentGroupSlug(setToGroupSlug, useQueryArgs)
  const [{ group, fetching: groupFetching, isContextGroupSlug, error }, reQuery] = useGroup({
    groupSlug,
    groupQueryScope,
    useQueryArgs
  })
  const fetching = slugFetching || groupFetching

  useEffect(() => {
    if (!fetching && group && setToGroupSlug) {
      mixpanel.getGroup('groupId', group.id).set({
        $location: group.location,
        $name: group.name,
        type: group.type
      })
    }
  }, [fetching, group])

  return [{ currentGroup: group, isContextGroupSlug, fetching, error: slugError || error }, reQuery]
}
