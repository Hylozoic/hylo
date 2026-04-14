import { useEffect } from 'react'
import * as Sentry from '@sentry/react-native'
import useOpenURL from 'hooks/useOpenURL'
import useLinkingStore from 'navigation/linking/store'

export default function useOpenInitialURL (loading, wait = 0) {
  const openURL = useOpenURL()
  const { initialURL, setInitialURL } = useLinkingStore()

  const openInitialURL = async () => {
    if (!loading && initialURL) {
      setTimeout(() => {
        setInitialURL(null)
        openURL(initialURL).catch(err => Sentry.captureException(err, { extra: { initialURL } }))
      }, wait)
    } else {
      setInitialURL(null)
    }
  }

  useEffect(() => {
    openInitialURL()
  }, [loading, initialURL])

  return initialURL
}
