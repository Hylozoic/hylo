import React, { useCallback } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native'
import { every, isEmpty } from 'lodash/fp'
import setReturnToOnAuthPath from 'store/actions/setReturnToOnAuthPath'
import useRouteParams from 'hooks/useRouteParams'
import { getAuthorized } from 'store/selectors/getAuthState'
import { openURL } from 'hooks/useOpenURL'
import useInvitation from 'store/actions/useInvitation'
import checkInvitation from 'store/actions/checkInvitation'
import LoadingScreen from 'screens/LoadingScreen'

export const SIGNUP_PATH = '/signup'
export const EXPIRED_INVITE_PATH = '/invite-expired'

export default function JoinGroup (props) {
  const navigation = useNavigation()
  const route = useRoute()
  const dispatch = useDispatch()
  const isAuthorized = useSelector(getAuthorized)
  const { token: invitationToken, accessCode } = useRouteParams()

  // Might be more clear to simply use `useEffect`
  useFocusEffect(
    useCallback(() => {
      (async function () {
        try {
          const invitationTokenAndCode = { invitationToken, accessCode }

          if (every(isEmpty, invitationTokenAndCode)) {
            throw new Error('Please provide either a `token` query string parameter or `accessCode` route param')
          }

          if (isAuthorized) {
            // eslint-disable-next-line react-hooks/rules-of-hooks
            const result = await dispatch(useInvitation(invitationTokenAndCode))
            const newMembership = result?.payload?.getData()?.membership
            const groupSlug = newMembership?.group?.slug

            if (groupSlug) {
              openURL(`/groups/${groupSlug}/explore`, true)
            } else {
              throw new Error('Join group was unsuccessful')
            }
          } else {
            const result = await dispatch(checkInvitation(invitationTokenAndCode))
            const isValidInvite = result?.payload?.getData()?.valid

            if (isValidInvite) {
              dispatch(setReturnToOnAuthPath(route.params?.originalLinkingPath))
              openURL('/signup?message=Signup or login to join this group.', true)
            } else {
              openURL('/signup?error=invite-expired', true)
            }
          }
        } catch (error) {
          console.log('!!! error', error)
          navigation.canGoBack() ? navigation.goBack() : openURL('/')
        }
      })()
    }, [])
  )

  return <LoadingScreen />
}
