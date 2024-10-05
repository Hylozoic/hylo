import { useNavigation } from '@react-navigation/native'
import useIsModalScreen, { modalScreenName } from 'hooks/useIsModalScreen'

export default function useGoToMember () {
  const navigation = useNavigation()
  const isModalScreen = useIsModalScreen()

  return memberId => {
    if (isModalScreen) {
      return navigation.navigate(modalScreenName('Member'), { id: memberId })
    } else {
      return navigation.navigate('Member', { id: memberId })
    }
  }
}
