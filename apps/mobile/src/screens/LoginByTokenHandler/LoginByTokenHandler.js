import React, { useCallback, useEffect } from 'react'
import { useDispatch } from 'react-redux'
import { useAuth } from '@hylo/contexts/AuthContext'
import loginByToken from 'store/actions/loginByToken'
import loginByJWT from 'store/actions/loginByJWT'
import { openURL } from 'hooks/useOpenURL'
import { StackActions, useFocusEffect, useRoute } from '@react-navigation/native'
import setReturnToOnAuthPath from 'store/actions/setReturnToOnAuthPath'
import { navigationRef } from 'navigation/linking/helpers'
import LoadingScreen from 'screens/LoadingScreen'

export default function LoginByTokenHandler () {
  const route = useRoute()
  const dispatch = useDispatch()
  const [{ isAuthorized, checkAuth }] = useAuth()
  const returnToURLFromLink = decodeURIComponent(route?.params?.n)
  const jwt = decodeURIComponent(route?.params?.token)
  const loginToken = decodeURIComponent(route?.params?.t || route?.params?.loginToken)
  const userID = route?.params?.u || route?.params?.userId

  useFocusEffect(
    useCallback(() => {
      (async function () {
        try {
          dispatch(setReturnToOnAuthPath(returnToURLFromLink || '/'))

          if (!isAuthorized) {
            if (jwt) {
              const response = await dispatch(loginByJWT(jwt))

              if (response?.error) throw response.error

              await checkAuth()
            } else if (loginToken && userID) {
              await dispatch(loginByToken(userID, loginToken))
            }
          }
        } catch (e) {
          console.log('!!! error', e)
          openURL('/login?bannerError=invalid-link')
        }
      })()
    }, [dispatch, isAuthorized, jwt, loginToken, userID, returnToURLFromLink])
  )

  // Removes this screen from the stack, one way or another
  useEffect(() => {
    if (navigationRef.canGoBack()) {
      navigationRef.dispatch(StackActions.pop())
    } else if (isAuthorized) {
      openURL('/', true)
    }
  }, [isAuthorized])

  return <LoadingScreen />
}
