import { useCallback } from 'react'
import { useFocusEffect, useNavigation } from '@react-navigation/native'
import { every, isEmpty } from 'lodash/fp'
import { useMutation, useQuery } from 'urql'
import { useAuth } from '@hylo/contexts/AuthContext'
import checkInvitationQuery from '@hylo/graphql/queries/checkInvitationQuery'
import acceptInvitationMutation from '@hylo/graphql/mutations/acceptInvitationMutation'
import useCurrentUser from '@hylo/hooks/useCurrentUser'
import useOpenURL from '../../hooks/useOpenURL'
import useRouteParams from '../../hooks/useRouteParams'
import useLinkingStore from '../../navigation/linking/store'
import LoadingScreen from '../../components/LoadingScreen'

export default function JoinGroupScreen () {
  const navigation = useNavigation()
  const openURL = useOpenURL()
  const { setReturnToOnAuthPath } = useLinkingStore()
  const [, acceptInvitation] = useMutation(acceptInvitationMutation)
  const { fetching: authFetching, isAuthorized } = useAuth()
  const { token, accessCode, originalLinkingPath } = useRouteParams<{
    token?: string
    accessCode?: string
    originalLinkingPath?: string
  }>()
  const invitationTokenAndCode = { invitationToken: token, accessCode }
  const [{ data: checkInvitationData, fetching: checkInvitationFetching }] = useQuery({
    query: checkInvitationQuery,
    variables: invitationTokenAndCode,
    pause: isAuthorized
  })
  const [, refetchCurrentUser] = useCurrentUser({ pause: true, requestPolicy: 'network-only' })
  const fetching = authFetching || checkInvitationFetching
  const isValidInvite = checkInvitationData?.checkInvitation?.valid

  useFocusEffect(
    useCallback(() => {
      if (fetching) return

      ;(async () => {
        try {
          if (every(isEmpty, invitationTokenAndCode)) {
            throw new Error('Please provide either a `token` query string parameter or `accessCode` route param')
          }

          if (isAuthorized) {
            const { data } = await acceptInvitation(invitationTokenAndCode)
            const newMembership = data?.useInvitation?.membership
            const groupSlug = newMembership?.group?.slug

            await refetchCurrentUser()

            if (groupSlug) {
              await openURL(`/groups/${groupSlug}`)
            } else {
              throw new Error('Join group was unsuccessful')
            }
          } else if (isValidInvite) {
            setReturnToOnAuthPath(originalLinkingPath ?? null)
            await openURL('/signup?message=Signup or login to join this group.', { reset: true })
          } else {
            await openURL('/signup?error=invite-expired', { reset: true })
          }
        } catch (error) {
          console.warn('JoinGroup failed:', error)
          if (navigation.canGoBack()) {
            navigation.goBack()
          } else {
            await openURL('/')
          }
        }
      })()
    }, [fetching, isValidInvite, isAuthorized])
  )

  return <LoadingScreen />
}
