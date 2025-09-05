import { useCallback, useEffect } from 'react'
import { useNavigation } from '@react-navigation/native'
import { useMutation } from 'urql'
import updateMembershipMutation from '@hylo/graphql/mutations/updateMembershipMutation'
import { isStaticContext } from '@hylo/presenters/GroupPresenter'
import useCurrentUser from '@hylo/hooks/useCurrentUser'
import useCurrentGroup, { getLastViewedGroupSlug, useCurrentGroupStore } from '@hylo/hooks/useCurrentGroup'
import { widgetUrl } from '@hylo/navigation'
import useOpenURL from 'hooks/useOpenURL'
import mixpanel from 'services/mixpanel'
import useConfirmAlert from 'hooks/useConfirmAlert'
import useRouteParams from 'hooks/useRouteParams'
import getActiveRoute from 'navigation/getActiveRoute'

export function useHandleCurrentGroupSlug () {
  const { currentGroupSlug } = useCurrentGroupStore()
  const { context, groupSlug, originalLinkingPath, pathMatcher } = useRouteParams()
  const [{ currentUser }] = useCurrentUser()
  const changeToGroup = useChangeToGroup()
  const pathMatches = originalLinkingPath?.match(/\/groups\/([^\/]+)(.*$)/)
  const groupSlugFromPath = pathMatches?.[1] ?? null
  const pathAfterMatch = pathMatches?.[2] ?? null
  useEffect(() => {
    if (currentUser?.memberships && !currentGroupSlug && !groupSlugFromPath) {
      changeToGroup(getLastViewedGroupSlug(currentUser)) // tempting to switch this to NoContextFallbackScreen
    }
    // Yet ANOTHER edge-case that needs to be specifically handled. This is needed when a user logs out (sets myContext) and then logs back in
    if (currentUser?.memberships && isStaticContext(currentGroupSlug) && !groupSlugFromPath) {
      changeToGroup(currentGroupSlug)
    }
  }, [currentUser?.memberships, currentGroupSlug])

  useEffect(() => {
    if (context) {
      let newGroupSlug

      if (context === 'groups' && (groupSlugFromPath || groupSlug)) {
        newGroupSlug = groupSlugFromPath || groupSlug
      } else if (isStaticContext(context)) {
        newGroupSlug = context
      }

      if (newGroupSlug) {
        const shouldNavigateHome = !pathAfterMatch && !isStaticContext(newGroupSlug)
        changeToGroup(newGroupSlug, { navigateHome: shouldNavigateHome })
      }
    }
  }, [context, groupSlugFromPath])
  // explicitly no use of groupSlug in the dependency array
}

export function useHandleCurrentGroup () {
  const { setNavigateHome, navigateHome } = useCurrentGroupStore()
  const openURL = useOpenURL()
  const navigation = useNavigation()
  const [{ currentUser, fetching: fetchingCurrentUser }] = useCurrentUser()
  const [{ currentGroup, fetching: fetchingCurrentGroup }] = useCurrentGroup()
  const loading = fetchingCurrentUser && fetchingCurrentGroup

  const { context, groupSlug, originalLinkingPath } = useRouteParams()
  useEffect(() => {
    if (!loading && currentUser && currentGroup) {
      mixpanel.getGroup('groupId', currentGroup.id).set({
        $location: currentGroup.location,
        $name: currentGroup.name,
        type: currentGroup.type
      })

      if (currentGroup?.getShouldWelcome(currentUser)) {
        setNavigateHome(false)
        navigation.replace('Group Welcome')
      } else if (currentGroup?.homeWidget && navigateHome) {
        console.log('useHandleCurrentGroup DOES IT GO TO THIS LOFIC', currentGroup?.slug)
        setNavigateHome(false)
        // Only "replace" current HomeNavigator stack if there are mounted screens,
        // otherwise begins loading the default HomeNavigator screen then replaces
        // it the homeWidget which creates two navigation animations
        const hasMountedScreens = !!navigation.getState()?.routes[0].params
        if (currentGroup?.slug === 'my') {
          // reset replaces the existing stack with a new one. This help avoid the 'my' context having stale/buggy screens from a prior stack in its history
          navigation.reset({
            index: 0,
            routes: [{ name: 'Context Menu' }]
          })
        } else {
          openURL(widgetUrl({ widget: currentGroup.homeWidget, groupSlug: currentGroup.slug }), { replace: hasMountedScreens, reset: true })
        }
      }
    }
  }, [currentGroup, currentUser])

  useEffect(() => {
    const unsubscribe = navigation.addListener('beforeRemove', (event) => {
      const nextRoute = getActiveRoute(event.data.action?.payload)
      if (currentGroup?.getShouldWelcome(currentUser) && nextRoute?.screen !== 'Group Welcome') {
        event.preventDefault()
      }
    })
    return unsubscribe
  }, [currentGroup, currentUser])
}

export function useChangeToGroup () {
  const navigation = useNavigation()
  const confirmAlert = useConfirmAlert()
  const openURL = useOpenURL()
  const { setCurrentGroupSlug, setNavigateHome } = useCurrentGroupStore()
  const [{ currentUser }] = useCurrentUser()
  const [, updateMembership] = useMutation(updateMembershipMutation)

  const changeToGroup = useCallback((groupSlug, {
    confirm = false,
    navigateHome = true,
    skipCanViewCheck = false
  } = {}) => {
    const canViewGroup = currentUser?.memberships.find(m => m.group.slug === groupSlug) ||
      isStaticContext(groupSlug) ||
      skipCanViewCheck

    if (canViewGroup) {
        const goToGroup = () => {
        setNavigateHome(navigateHome)
        setCurrentGroupSlug(groupSlug)
          const membership = currentUser?.memberships?.find(m => m.group.slug === groupSlug)
          const groupId = membership?.group?.id
          if (groupId) {
            updateMembership({ groupId, data: { lastViewedAt: new Date().toISOString() } })
          }
      }
      if (confirm) {
        confirmAlert({
          title: 'Changing Groups',
          confirmMessage: 'Do you want to switch to this group?',
          confirmButtonText: 'Yes',
          cancelButtonText: 'Cancel',
          onConfirm: () => goToGroup()
        })
      } else {
        goToGroup()
      }
        } else {
        // Use URL-based navigation which is more reliable during cold boot
        // This navigates to the non-modal Group Explore screen
        openURL(`/groups/${groupSlug}/explore`)
      }
  }, [setNavigateHome, setCurrentGroupSlug, currentUser?.memberships, confirmAlert, openURL])

  return changeToGroup
}
