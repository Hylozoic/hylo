import React, { useCallback } from 'react'
import { useFocusEffect, useNavigation } from '@react-navigation/native'
import { every, isEmpty } from 'lodash/fp'
import { useMutation, useQuery } from 'urql'
import { useAuth } from '@hylo/contexts/AuthContext'
import checkInvitationQuery from '@hylo/graphql/queries/checkInvitationQuery'
import acceptInvitationMutation from '@hylo/graphql/mutations/acceptInvitationMutation'
import useCurrentUser from '@hylo/hooks/useCurrentUser'
import { useChangeToGroup } from 'hooks/useHandleCurrentGroup'
import useOpenURL from 'hooks/useOpenURL'
import useRouteParams from 'hooks/useRouteParams'
import useLinkingStore from 'navigation/linking/store'
import LoadingScreen from 'screens/LoadingScreen'

export default function JoinGroup (props) {
  const navigation = useNavigation()
  const openURL = useOpenURL()
  const { setReturnToOnAuthPath } = useLinkingStore()
  const changeToGroup = useChangeToGroup()
  const [, acceptInvitation] = useMutation(acceptInvitationMutation)
  const { fetching: authFetching, isAuthorized } = useAuth()
  const { token, accessCode, originalLinkingPath } = useRouteParams()
  const invitationTokenAndCode = { invitationToken: token, accessCode }
  const [{ data: checkInvitationData, fetching: checkInvitationFetching }] = useQuery({
    query: checkInvitationQuery,
    variables: invitationTokenAndCode,
    pause: isAuthorized
  })
  const [, refetchCurrentUser] = useCurrentUser({ pause: true, requestPolicy: 'network-only' })
  const fetching = authFetching || checkInvitationFetching
  const isValidInvite = checkInvitationData?.checkInvitation?.valid

  // Might be more clear to simply use `useEffect`
  useFocusEffect(
    useCallback(() => {
      (async function () {
        if (!fetching) {
          try {
            if (every(isEmpty, invitationTokenAndCode)) {
              throw new Error('Please provide either a `token` query string parameter or `accessCode` route param')
            }

            if (isAuthorized) {
              const { data, error } = await acceptInvitation(invitationTokenAndCode)
              const newMembership = data?.useInvitation?.membership
              const groupSlug = newMembership?.group?.slug

              await refetchCurrentUser()

              if (groupSlug) {
                changeToGroup(groupSlug, { skipCanViewCheck: true })
              } else {
                throw new Error('Join group was unsuccessful', error)
              }
            } else {
              if (isValidInvite) {
                setReturnToOnAuthPath(originalLinkingPath)
                openURL('/signup?message=Signup or login to join this group.', { reset: true })
              } else {
                openURL('/signup?error=invite-expired', { reset: true })
              }
            }
          } catch (error) {
            console.log('!!! error', error)
            navigation.canGoBack() ? navigation.goBack() : openURL('/')
          }
        }
      })()
    }, [fetching, isValidInvite])
  )

  return <LoadingScreen />
}
