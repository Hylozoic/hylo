import { create } from 'zustand'
import { flow, orderBy, first, getOr } from 'lodash/fp'
import { MY_CONTEXT_SLUG } from '@hylo/shared'
import useGroup from './useGroup'

export const useCurrentGroupStore = create((set) => ({
  currentGroupSlug: null,
  navigateHome: true,
  setCurrentGroupSlug: currentGroupSlug => set({ currentGroupSlug }),
  setNavigateHome: navigateHome => set({ navigateHome })
}))

export const getLastViewedGroupSlug = currentUser => flow(
  getOr([], 'memberships'),
  orderBy('lastViewedAt', 'desc'),
  first,
  getOr(MY_CONTEXT_SLUG, 'group.slug')
)(currentUser)

export default function useCurrentGroup ({
  groupQueryScope = {
    withJoinQuestions: true,
    withPrerequisiteGroups: true,
    withContextWidgets: true
  },
  useQueryArgs = {}
} = {}) {
  const { currentGroupSlug } = useCurrentGroupStore()
  const [{ group: currentGroup, ...rest }] = useGroup({
    groupSlug: currentGroupSlug,
    groupQueryScope,
    useQueryArgs
  })

  return [{ currentGroupSlug, currentGroup, ...rest }]
}
