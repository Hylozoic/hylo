import React, { useCallback } from 'react'
import { useFocusEffect, useNavigation } from '@react-navigation/native'
import { every, isEmpty } from 'lodash/fp'
import { useMutation, useQuery } from 'urql'
import { useDispatch } from 'react-redux'
import { openURL } from 'hooks/useOpenURL'
import useAuthStatus from 'urql-shared/hooks/useAuthStatus'
import useRouteParams from 'hooks/useRouteParams'
import setReturnToOnAuthPath from 'store/actions/setReturnToOnAuthPath'
import checkInvitationQuery from 'graphql/queries/checkInvitationQuery'
import acceptInvitationMutation from 'graphql/mutations/acceptInvitationMutation'
import LoadingScreen from 'screens/LoadingScreen'

export default function JoinGroup (props) {
  const navigation = useNavigation()
  const dispatch = useDispatch()
  const { token: invitationToken, accessCode, originalLinkingPath } = useRouteParams()
  const invitationTokenAndCode = { invitationToken, accessCode }

  const [, checkInvitation] = useQuery({ query: checkInvitationQuery, variables: invitationTokenAndCode, pause: true })
  const [, acceptInvitation] = useMutation(acceptInvitationMutation)
  const [{ isAuthorized }] = useAuthStatus()

  // Might be more clear to simply use `useEffect`
  useFocusEffect(
    useCallback(() => {
      (async function () {
        try {
          if (every(isEmpty, invitationTokenAndCode)) {
            throw new Error('Please provide either a `token` query string parameter or `accessCode` route param')
          }

          if (isAuthorized) {
            // eslint-disable-next-line react-hooks/rules-of-hooks
            const { data } = await acceptInvitation(invitationTokenAndCode)
            const newMembership = data?.acceptInvitation?.membership
            const groupSlug = newMembership?.group?.slug

            if (groupSlug) {
              openURL(`/groups/${groupSlug}/explore`, true)
            } else {
              throw new Error('Join group was unsuccessful')
            }
          } else {
            const result = await checkInvitation()
            const isValidInvite = result?.payload?.getData()?.valid

            if (isValidInvite) {
              dispatch(setReturnToOnAuthPath(originalLinkingPath))
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
