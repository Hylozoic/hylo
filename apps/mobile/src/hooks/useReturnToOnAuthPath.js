import { useEffect } from 'react'
import { isEmpty } from 'lodash/fp'
import useLinkingStore from 'navigation/linking/store'
import { openURL } from 'hooks/useOpenURL'

export default function useReturnToOnAuthPath (loading = false) {
  const { returnToOnAuthPath, setReturnToOnAuthPath } = useLinkingStore()

  useEffect(() => {
    (async function () {
      if (!loading && !isEmpty(returnToOnAuthPath)) {
        setReturnToOnAuthPath()
        await openURL(returnToOnAuthPath)
      }
    })()
  }, [
    loading,
    returnToOnAuthPath
  ])

  return returnToOnAuthPath
}
