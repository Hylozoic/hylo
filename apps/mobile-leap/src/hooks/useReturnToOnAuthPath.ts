import { useEffect } from 'react'
import * as Sentry from '@sentry/react-native'
import useLinkingStore from '../navigation/linking/store'
import { openURL } from './useOpenURL'

// After login, navigate to a path that was stored while the user was logged out.
export default function useReturnToOnAuthPath (loading = false) {
  const { returnToOnAuthPath, setReturnToOnAuthPath } = useLinkingStore()

  useEffect(() => {
    if (loading || !returnToOnAuthPath) return

    const path = returnToOnAuthPath
    setReturnToOnAuthPath(null)

    openURL(path).catch(err =>
      Sentry.captureException(err, { extra: { returnToOnAuthPath: path } })
    )
  }, [loading, returnToOnAuthPath, setReturnToOnAuthPath])

  return returnToOnAuthPath
}
