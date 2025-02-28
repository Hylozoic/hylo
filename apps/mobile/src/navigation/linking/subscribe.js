import { Linking } from 'react-native'

export default function subscribe (listener) {
  const linkingSubscription = Linking.addEventListener('url', ({ url }) => {
    console.log('!!!! url in subscribe:', url)
    listener(url)
  })

  return () => {
    linkingSubscription.remove()
  }
}
