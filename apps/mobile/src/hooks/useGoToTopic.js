import { useNavigation } from '@react-navigation/native'
import { isContextGroup } from 'urql-shared/presenters/GroupPresenter'
import useCurrentGroup from './useCurrentGroup'
import useIsModalScreen from './useIsModalScreen'

export default function useGoToTopic () {
  const navigation = useNavigation()
  const isModalScreen = useIsModalScreen()
  const [currentGroup] = useCurrentGroup()

  return topicName => {
    if (isModalScreen) {
      return null
    } else {
      if (isContextGroup(currentGroup?.slug)) {
        return navigation.navigate('Stream', { topicName })
      } else {
        return navigation.navigate('Chat', { topicName })
      }
    }
  }
}
