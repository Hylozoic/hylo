import { useNavigation } from '@react-navigation/native'
import { isContextGroup } from 'urql-shared/presenters/GroupPresenter'
import { useCurrentGroupSlug } from 'urql-shared/hooks/useCurrentGroup'
import useIsModalScreen from './useIsModalScreen'

export default function useGoToTopic () {
  const navigation = useNavigation()
  const isModalScreen = useIsModalScreen()
  const [{ currentGroupSlug }] = useCurrentGroupSlug()

  return topicName => {
    if (isModalScreen) {
      return null
    } else {
      if (isContextGroup(currentGroupSlug)) {
        return navigation.navigate('Stream', { topicName })
      } else {
        return navigation.navigate('Chat', { topicName })
      }
    }
  }
}
