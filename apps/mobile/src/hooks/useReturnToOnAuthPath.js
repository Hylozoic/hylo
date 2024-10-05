import { useEffect } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { isEmpty } from 'lodash/fp'
import { openURL } from 'hooks/useOpenURL'
import setReturnToOnAuthPath from 'store/actions/setReturnToOnAuthPath'
import getReturnToOnAuthPath from 'store/selectors/getReturnToOnAuthPath'

export default function useReturnToOnAuthPath (loading = false) {
  const returnToOnAuthPath = useSelector(getReturnToOnAuthPath)
  const dispatch = useDispatch()

  useEffect(() => {
    (async function () {
      if (!loading && !isEmpty(returnToOnAuthPath)) {
        await dispatch(setReturnToOnAuthPath())
        await openURL(returnToOnAuthPath)
      }
    })()
  }, [
    loading,
    returnToOnAuthPath
  ])

  return null
}
