import { Linking } from 'react-native'
import useLinkingStore from 'navigation/linking/store'

export default async function getInitialURL () {
  const initialURL = await Linking.getInitialURL()

  useLinkingStore.getState().setInitialURL(initialURL)

  return null
}
