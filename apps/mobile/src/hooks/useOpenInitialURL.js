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
    }
    // Do NOT clear initialURL when loading=true. If the click handler or getInitialURL
    // stored a URL before auth completed, we want it to persist until loading is false
    // and this effect re-fires to actually open it.
  }

  useEffect(() => {
    openInitialURL()
  }, [loading, initialURL])

  return initialURL
}
