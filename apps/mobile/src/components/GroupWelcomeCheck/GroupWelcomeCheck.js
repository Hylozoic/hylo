import React, { useEffect } from 'react'
import { useSelector } from 'react-redux'
import { ALL_GROUP, MY_CONTEXT_GROUP, PUBLIC_GROUP } from 'store/models/Group'
import presentGroup from 'store/presenters/presentGroup'
import getMyMemberships from 'store/selectors/getMyMemberships'
import getGroup from 'store/selectors/getGroup'
import { useNavigation } from '@react-navigation/native'

export default function GroupWelcomeCheck ({ groupId }) {
  if (groupId === ALL_GROUP.id || groupId === PUBLIC_GROUP.id || groupId === MY_CONTEXT_GROUP.id) {
    return null
  }
  const currentGroup = useSelector(state => getGroup(state, { id: groupId }))
  const navigation = useNavigation()
  const currentMemberships = useSelector(state => getMyMemberships(state))
  const currentMembership = currentMemberships.find(m => m.group.id === groupId)
  const group = presentGroup(currentGroup)
  const { agreements, settings } = group
  const { agreementsAcceptedAt, joinQuestionsAnsweredAt, showJoinForm } = currentMembership?.settings || {}

  const numAgreements = agreements?.length || 0

  const agreementsChanged = numAgreements > 0 &&
  (!agreementsAcceptedAt || agreementsAcceptedAt < currentGroup.settings.agreementsLastUpdatedAt)

  useEffect(() => {
    if (showJoinForm || agreementsChanged || (settings?.askJoinQuestions && !joinQuestionsAnsweredAt)) {
      navigation.navigate('Group Welcome', { groupId })
    }
  }, [showJoinForm, agreementsChanged, joinQuestionsAnsweredAt])

  return null
}
