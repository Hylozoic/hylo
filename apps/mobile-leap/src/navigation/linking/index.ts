import { Linking } from 'react-native'
import getStateFromPath from './getStateFromPath'
import getInitialURL from './getInitialURL'
import { prefixes } from './config'

export * from './config'

export default {
  prefixes,
  getStateFromPath,
  getInitialURL,
  subscribe (listener: (url: string) => void) {
    const onReceiveURL = ({ url }: { url: string }) => listener(url)
    const sub = Linking.addEventListener('url', onReceiveURL)
    return () => sub.remove()
  }
}
