import { useCallback, useEffect } from 'react'
import { useNavigation } from '@react-navigation/native'
import { isStaticContext } from '@hylo/presenters/GroupPresenter'
import useCurrentUser from '@hylo/hooks/useCurrentUser'
import useCurrentGroup, { getLastViewedGroupSlug, useCurrentGroupStore } from '@hylo/hooks/useCurrentGroup'
import { widgetUrl } from 'util/navigation'
import mixpanel from 'services/mixpanel'
import useOpenURL from 'hooks/useOpenURL'
import useConfirmAlert from 'hooks/useConfirmAlert'
import useRouteParams from 'hooks/useRouteParams'
import { modalScreenName } from 'hooks/useIsModalScreen'
import getActiveRoute from 'navigation/getActiveRoute'

export function useHandleCurrentGroupSlug () {
  const { currentGroupSlug } = useCurrentGroupStore()
  const { context, groupSlug } = useRouteParams()
  const [{ currentUser }] = useCurrentUser()
  const changeToGroup = useChangeToGroup()

  useEffect(() => {
    if (currentUser && !currentGroupSlug) {
      changeToGroup(getLastViewedGroupSlug(currentUser))
    }
  }, [currentUser, currentGroupSlug])

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

export function useHandleCurrentGroup () {
  const { setNavigateHome, navigateHome } = useCurrentGroupStore()
  const openURL = useOpenURL()
  const navigation = useNavigation()
  const [{ currentUser, fetching: fetchingCurrentUser }] = useCurrentUser()
  const [{ currentGroup, fetching: fetchingCurrentGroup }] = useCurrentGroup()
  const loading = fetchingCurrentUser && fetchingCurrentGroup

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
        setNavigateHome(false)
        openURL(widgetUrl({ widget: currentGroup.homeWidget, groupSlug: currentGroup.slug }), { replace: true })
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
  const { setCurrentGroupSlug, setNavigateHome } = useCurrentGroupStore()
  const [{ currentUser }] = useCurrentUser()

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
        if (navigateHome) setNavigateHome(navigateHome)
        setCurrentGroupSlug(groupSlug)
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
      navigation.navigate(modalScreenName('Group Explore'), { groupSlug })
    }
  }, [setNavigateHome, setCurrentGroupSlug, currentUser?.memberships])

  return changeToGroup
}
