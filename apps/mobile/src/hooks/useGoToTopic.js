import { useNavigation } from '@react-navigation/native'
import { isContextGroupSlug } from '@hylo/presenters/GroupPresenter'
import { useCurrentGroupSlug } from '@hylo/hooks/useCurrentGroup'
import useIsModalScreen from './useIsModalScreen'

export default function useGoToTopic () {
  const navigation = useNavigation()
  const isModalScreen = useIsModalScreen()
  const [{ currentGroupSlug }] = useCurrentGroupSlug()

  return topicName => {
    if (isModalScreen) {
      return null
    } else {
      if (isContextGroupSlug(currentGroupSlug)) {
        return navigation.navigate('Stream', { topicName })
      } else {
        return navigation.navigate('Chat Room', { topicName })
      }
    }
  }
}
