import { Linking } from 'react-native'
import useLinkingStore from './store'

export default async function getInitialURL () {
  const initialURL = await Linking.getInitialURL()
  useLinkingStore.getState().setInitialURL(initialURL)
  return null
}
