import React, { useCallback, useEffect } from 'react'
import { useDispatch } from 'react-redux'
import { StackActions, useFocusEffect, useRoute } from '@react-navigation/native'
import { useAuth } from '@hylo/contexts/AuthContext'
import loginByToken from 'store/actions/loginByToken'
import loginByJWT from 'store/actions/loginByJWT'
import { saveTokens } from 'util/tokenStore'
import useLinkingStore from 'navigation/linking/store'
import { navigationRef } from 'navigation/linking/helpers'
import { openURL } from 'hooks/useOpenURL'
import LoadingScreen from 'screens/LoadingScreen'

function safeDecodeURIComponent (value) {
  if (typeof value !== 'string') return value
  try {
    return decodeURIComponent(value)
  } catch (err) {
    return value
  }
}

export default function LoginByTokenHandler () {
  const route = useRoute()
  const dispatch = useDispatch()
  const { setReturnToOnAuthPath } = useLinkingStore()
  const { isAuthorized, checkAuth } = useAuth()
  const returnToURLFromLink = safeDecodeURIComponent(route?.params?.n)
  const jwt = safeDecodeURIComponent(route?.params?.token)
  const loginToken = safeDecodeURIComponent(route?.params?.t || route?.params?.loginToken)
  const userID = route?.params?.u || route?.params?.userId

  useFocusEffect(
    useCallback(() => {
      (async function () {
        try {
          setReturnToOnAuthPath(returnToURLFromLink || '/')

          if (!isAuthorized) {
            if (jwt) {
              const response = await dispatch(loginByJWT(jwt))

              if (response?.error) throw response.error

              // Persist the token pair returned by the token-auth header so the
              // magic-link login lands on the same Keychain-token path (Bearer +
              // transparent refresh) as the other login methods.
              if (response?.payload?.access_token) {
                await saveTokens(response.payload)
              }

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
      openURL('/', { reset: true })
    }
  }, [isAuthorized])

  return <LoadingScreen />
}
