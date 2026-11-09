import { useCallback, useEffect } from 'react'
import { StackActions, useFocusEffect, useRoute } from '@react-navigation/native'
import { useAuth } from '@hylo/contexts/AuthContext'
import { loginByJWT, loginByToken } from 'util/authApi'
import { saveTokens } from 'util/tokenStore'
import useLinkingStore from '../../navigation/linking/store'
import { navigationRef } from '../../navigation/linking/helpers'
import { openURL } from '../../hooks/useOpenURL'
import LoadingScreen from '../../components/LoadingScreen'

function safeDecode (value: unknown) {
  if (typeof value !== 'string') return value
  try {
    return decodeURIComponent(value)
  } catch {
    return value
  }
}

export default function LoginByTokenHandlerScreen () {
  const route = useRoute()
  const params = (route.params ?? {}) as Record<string, string>
  const { setReturnToOnAuthPath } = useLinkingStore()
  const { isAuthorized, checkAuth } = useAuth()
  const returnToURLFromLink = safeDecode(params.n) as string | undefined
  const jwt = safeDecode(params.token) as string | undefined
  const loginToken = safeDecode(params.t || params.loginToken) as string | undefined
  const userID = params.u || params.userId

  useFocusEffect(
    useCallback(() => {
      (async () => {
        try {
          setReturnToOnAuthPath(returnToURLFromLink || '/')

          if (!isAuthorized) {
            if (jwt) {
              const payload = await loginByJWT(jwt as string)
              if (payload?.access_token) await saveTokens(payload)
              await checkAuth()
            } else if (loginToken && userID) {
              await loginByToken(userID, loginToken as string)
              await checkAuth()
            }
          }
        } catch {
          openURL('/login?bannerError=invalid-link')
        }
      })()
    }, [isAuthorized, jwt, loginToken, userID, returnToURLFromLink, checkAuth, setReturnToOnAuthPath])
  )

  useEffect(() => {
    if (navigationRef.canGoBack()) {
      navigationRef.dispatch(StackActions.pop())
    } else if (isAuthorized) {
      openURL('/')
    }
  }, [isAuthorized])

  return <LoadingScreen />
}
