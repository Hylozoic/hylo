import { useCallback, useEffect } from 'react'
import { Alert } from 'react-native'
import { create } from 'zustand'
import { MY_CONTEXT_SLUG } from '@hylo/shared'
import { isStaticContext } from '@hylo/presenters/GroupPresenter'
import useCurrentUser from '@hylo/hooks/useCurrentUser'
import { widgetUrl } from 'util/navigation'
import useOpenURL from 'hooks/useOpenURL'
import useGroup from './useGroup'
import useRouteParams from 'hooks/useRouteParams'

export const useCurrentGroupStore = create((set) => ({
  currentGroupSlug: null,
  navigateHome: true,
  setCurrentGroupSlug: currentGroupSlug => set({ currentGroupSlug }),
  setNavigateHome: navigateHome => set({ navigateHome })
}))

/** ✅ When currentGroupSlug not set, set it to lastViewedGroup if available, otherwise to the My context */
export function useInitCurrentGroupSlug () {
  const { currentGroupSlug } = useCurrentGroupStore()
  const { context, groupSlug } = useRouteParams()
  const [{ currentUser }] = useCurrentUser()
  const changeToGroup = useChangeToGroup()

  useEffect(() => {
    if (!currentUser) return
    if (!currentGroupSlug) {
      const lastViewedGroupSlug = currentUser?.memberships?.length &&
        [...currentUser.memberships]
          .sort((a, b) => new Date(b.lastViewedAt) - new Date(a.lastViewedAt))[0]?.group?.slug

      changeToGroup(lastViewedGroupSlug || MY_CONTEXT_SLUG)
    }
  }, [currentUser])

  /** ✅ Updates `currentGroupSlug` when deep linking parameters change */
  useEffect(() => {
    if (context) {
      let newGroupSlug

      if (context === 'groups' && groupSlug) {
        newGroupSlug = groupSlug
      } else if (isStaticContext(context)) {
        newGroupSlug = context
      }

      if (newGroupSlug) {
        changeToGroup(newGroupSlug, { navigateHome: false })
      }
    }
  }, [context, groupSlug])
}

export function useNavigateHome () {
  const { navigateHome, setNavigateHome, currentGroupSlug } = useCurrentGroupStore()
  const [{ currentGroup, fetching }] = useCurrentGroup()
  const openURL = useOpenURL()

  useEffect(() => {
    if (!fetching && currentGroup?.homeWidget && navigateHome) {
      setNavigateHome(false)
      openURL(widgetUrl({ widget: currentGroup.homeWidget, groupSlug: currentGroup.slug }), { replace: true })
    }
  }, [fetching, currentGroupSlug])
}

export function useChangeToGroup () {
  const { setCurrentGroupSlug, setNavigateHome } = useCurrentGroupStore()
  const changeToGroup = useCallback((groupSlug, {
    confirm = false,
    navigateHome = true,
    // TODO: Re-implement canViewCheck
    skipCanViewCheck = true
  } = {}) => {
    const goToGroup = () => {
      if (navigateHome) {
        setNavigateHome(navigateHome)
      }
      setCurrentGroupSlug(groupSlug)
    }

    confirm ? confirmNavigate(goToGroup) : goToGroup()
  }, [setNavigateHome, setCurrentGroupSlug])

  return changeToGroup
}

export default function useCurrentGroup ({
  groupQueryScope = {
    withJoinQuestions: true,
    withPrerequisiteGroups: true,
    withContextWidgets: true
  },
  useQueryArgs = {}
} = {}) {
  const { currentGroupSlug } = useCurrentGroupStore()
  const [{ group: currentGroup, fetching, ...rest }] = useGroup({ groupSlug: currentGroupSlug, groupQueryScope, useQueryArgs })

  return [{ currentGroupSlug, currentGroup, fetching, ...rest }]
}

/** ✅ Handles group switching with confirmation & navigation */
function confirmNavigate (onConfirm, options = {}) {
  Alert.alert(
    options.title || 'Changing Groups',
    options.confirmationMessage || 'Do you want to switch to this group?',
    [
      { text: options.confirmButtonText || 'Yes', onPress: onConfirm },
      { text: options.cancelButtonText || 'Cancel', style: 'cancel' }
    ]
  )
}

// TODO: Bring back GroupWelcome redirect on changeGroup
// useEffect(() => {
//   if ((!fetching && currentGroup?.getShouldWelcome(currentUser))) {
//     navigation.replace('Group Welcome')
//   }
// }, [fetching, currentUser, currentGroup])

// TODO: Bring back mixpanel getGroup identification on changeGroup
// useEffect(() => {
//   if (!fetching && group && setToGroupSlug) {
//     mixpanel.getGroup('groupId', group.id).set({
//       $location: group.location,
//       $name: group.name,
//       type: group.type
//     })
//   }
// }, [fetching, group])

// /** ✅ Async fetch group details */
// async function asyncFetchGroup (groupSlug, client, currentUser) {
//   const { data } = await client.query(
//     groupDetailsQueryMaker({ withContextWidgets: true }),
//     { slug: groupSlug }
//   ).toPromise()
//   return GroupPresenter(data?.group, { currentUser })
// }
