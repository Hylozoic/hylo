import { useEffect } from 'react'
import { useNavigation } from '@react-navigation/native'
import useCurrentUser from 'urql-shared/hooks/useCurrentUser'
import useCurrentGroup from 'urql-shared/hooks/useCurrentGroup'

export default function GroupWelcomeCheck () {
  const navigation = useNavigation()
  const [{ currentUser }] = useCurrentUser()
  const [{ currentGroup, isContextGroup, fetching }] = useCurrentGroup()
  const currentMembership = currentUser?.memberships &&
    currentUser.memberships.find(m => m.group.id === currentGroup?.id)

  const { agreementsAcceptedAt, joinQuestionsAnsweredAt, showJoinForm } = currentMembership?.settings || {}

  const numAgreements = currentGroup?.agreements?.total || 0

  const agreementsChanged = (!isContextGroup && numAgreements > 0) &&
    (!agreementsAcceptedAt || agreementsAcceptedAt < currentGroup?.settings?.agreementsLastUpdatedAt)

  useEffect(() => {
    if (!fetching) {
      if ((!isContextGroup && showJoinForm) || agreementsChanged || (currentGroup?.settings?.askJoinQuestions && !joinQuestionsAnsweredAt)) {
        navigation.navigate('Group Welcome', { groupId: currentGroup?.id })
      }
    }
  }, [isContextGroup, fetching, showJoinForm, agreementsChanged, joinQuestionsAnsweredAt])

  return null
}
