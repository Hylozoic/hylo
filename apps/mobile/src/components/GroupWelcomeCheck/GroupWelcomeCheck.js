import { useEffect } from 'react'
import { useNavigation } from '@react-navigation/native'
import useCurrentUser from '@hylo/hooks/useCurrentUser'
import useCurrentGroup from '@hylo/hooks/useCurrentGroup'

export default function GroupWelcomeCheck () {
  const navigation = useNavigation()
  const [{ currentGroup, fetching }] = useCurrentGroup()

  useEffect(() => {
    if (!fetching) {
      if ((currentGroup.shouldWelcome)) {
        navigation.navigate('Group Welcome', { groupId: currentGroup?.id })
      }
    }
  }, [currentGroup, fetching])

  return null
}
