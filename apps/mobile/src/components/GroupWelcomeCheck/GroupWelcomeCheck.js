import { useEffect } from 'react'
import { useNavigation } from '@react-navigation/native'
import useCurrentUser from '@hylo/hooks/useCurrentUser'
import useCurrentGroup from '@hylo/hooks/useCurrentGroup'

export default function GroupWelcomeCheck () {
  const navigation = useNavigation()
  const [{ currentUser }] = useCurrentUser()
  const [{ currentGroup, isContextGroupSlug, fetching }] = useCurrentGroup()
  const currentMembership = currentUser?.memberships &&
    currentUser.memberships.find(m => m.group.id === currentGroup?.id)

  const { agreementsAcceptedAt, joinQuestionsAnsweredAt, showJoinForm } = currentMembership?.settings || {}

  const numAgreements = currentGroup?.agreements?.total || 0

  const agreementsChanged = (!isContextGroupSlug && numAgreements > 0) &&
    (!agreementsAcceptedAt || agreementsAcceptedAt < currentGroup?.settings?.agreementsLastUpdatedAt)

  useEffect(() => {
    if (!fetching) {
      if ((!isContextGroupSlug && showJoinForm) || agreementsChanged || (currentGroup?.settings?.askJoinQuestions && !joinQuestionsAnsweredAt)) {
        navigation.navigate('Group Welcome', { groupId: currentGroup?.id })
      }
    }
  }, [isContextGroupSlug, fetching, showJoinForm, agreementsChanged, joinQuestionsAnsweredAt])

  return null
}
