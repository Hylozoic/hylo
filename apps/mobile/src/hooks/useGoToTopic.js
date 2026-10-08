import { useCallback } from 'react'
import { useNavigation } from '@react-navigation/native'
import useCurrentGroup from '@hylo/hooks/useCurrentGroup'
import useIsModalScreen from './useIsModalScreen'

export default function useGoToTopic () {
  const navigation = useNavigation()
  const isModalScreen = useIsModalScreen()
  const [{ currentGroup }] = useCurrentGroup()

  const goToTopic = useCallback(topicName => {
    if (isModalScreen) {
      return null
    } else {
      if (currentGroup?.isStaticContext) {
        return navigation.navigate('Stream', { topicName })
      } else {
        return navigation.navigate('Chat Room', { topicName })
      }
    }
  }, [currentGroup])

  return goToTopic
}
