import React, { useCallback } from 'react'
import { useFocusEffect, useNavigation } from '@react-navigation/native'
import { every, isEmpty } from 'lodash/fp'
import { useMutation, useQuery } from 'urql'
import { useDispatch } from 'react-redux'
import { useAuth } from '@hylo/contexts/AuthContext'
import { openURL } from 'hooks/useOpenURL'
import useRouteParams from 'hooks/useRouteParams'
import setReturnToOnAuthPath from 'store/actions/setReturnToOnAuthPath'
import checkInvitationQuery from '@hylo/graphql/queries/checkInvitationQuery'
import acceptInvitationMutation from '@hylo/graphql/mutations/acceptInvitationMutation'
import LoadingScreen from 'screens/LoadingScreen'
import useChangeToGroup from 'hooks/useChangeToGroup'

export default function JoinGroup (props) {
  const navigation = useNavigation()
  const dispatch = useDispatch()
  const changeToGroup = useChangeToGroup()
  const { token: invitationToken, accessCode, originalLinkingPath } = useRouteParams()
  const invitationTokenAndCode = { invitationToken, accessCode }

  const [, checkInvitation] = useQuery({ query: checkInvitationQuery, variables: invitationTokenAndCode, pause: true })
  const [, acceptInvitation] = useMutation(acceptInvitationMutation)
  const { isAuthorized } = useAuth()

  // Might be more clear to simply use `useEffect`
  useFocusEffect(
    useCallback(() => {
      (async function () {
        try {
          if (every(isEmpty, invitationTokenAndCode)) {
            throw new Error('Please provide either a `token` query string parameter or `accessCode` route param')
          }

          if (isAuthorized) {
            const { data, error } = await acceptInvitation(invitationTokenAndCode)
            const newMembership = data?.useInvitation?.membership
            const groupSlug = newMembership?.group?.slug

            if (groupSlug) {
              changeToGroup(groupSlug, false)
            } else {
              throw new Error('Join group was unsuccessful', error)
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
