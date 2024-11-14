import React, { useEffect } from 'react'
import { useQuery } from 'urql'
import { useNavigation } from '@react-navigation/native'
import useCurrentUser from 'urql-shared/hooks/useCurrentUser'
import groupDetailsQueryMaker from 'graphql/queries/groupDetailsQueryMaker'
import GroupPresenter, { ALL_GROUP, MY_CONTEXT_GROUP, PUBLIC_GROUP } from 'urql-shared/presenters/GroupPresenter'

export default function GroupWelcomeCheck ({ groupId }) {
  if (groupId === ALL_GROUP.id || groupId === PUBLIC_GROUP.id || groupId === MY_CONTEXT_GROUP.id) {
    return null
  }
  const navigation = useNavigation()
  const currentUser = useCurrentUser()
  const currentMemberships = currentUser.memberships
  const currentMembership = currentMemberships.find(m => m.group.id === groupId)

  const [{ data, fetching }] = useQuery({ query: groupDetailsQueryMaker(), variables: { id: groupId }})
  const currentGroup = data?.group || {}
  const group = GroupPresenter(currentGroup)
  const { agreements, settings } = group
  const { agreementsAcceptedAt, joinQuestionsAnsweredAt, showJoinForm } = currentMembership?.settings || {}

  const numAgreements = agreements?.total || 0

  const agreementsChanged = numAgreements > 0 &&
    (!agreementsAcceptedAt || agreementsAcceptedAt < currentGroup.settings.agreementsLastUpdatedAt)

  useEffect(() => {
    if (!fetching) {
      if (showJoinForm || agreementsChanged || (settings?.askJoinQuestions && !joinQuestionsAnsweredAt)) {
        navigation.navigate('Group Welcome', { groupId })
      }
    }
  }, [fetching, showJoinForm, agreementsChanged, joinQuestionsAnsweredAt])

  return null
}
