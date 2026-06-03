import { useEffect } from 'react'
import { isEmpty } from 'lodash/fp'
import * as Sentry from '@sentry/react-native'
import useLinkingStore from 'navigation/linking/store'
import { openURL } from 'hooks/useOpenURL'

export default function useReturnToOnAuthPath (loading = false) {
  const { returnToOnAuthPath, setReturnToOnAuthPath } = useLinkingStore()

  useEffect(() => {
    (async function () {
      if (!loading && !isEmpty(returnToOnAuthPath)) {
        setReturnToOnAuthPath()
        await openURL(returnToOnAuthPath).catch(err => Sentry.captureException(err, { extra: { returnToOnAuthPath } }))
      }
    })()
  }, [
    loading,
    returnToOnAuthPath
  ])

  return returnToOnAuthPath
}
