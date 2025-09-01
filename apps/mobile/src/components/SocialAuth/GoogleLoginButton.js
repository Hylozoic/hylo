import React, { useCallback } from 'react'
import Config from 'react-native-config'
import { useTranslation } from 'react-i18next'
import { GoogleSignin, statusCodes } from '@react-native-google-signin/google-signin'
import Button from 'components/Button'
import { StyleSheet } from 'react-native'
import Colors from '../../style/theme-colors'

GoogleSignin.configure({
  iosClientId: Config.IOS_GOOGLE_CLIENT_ID,
  webClientId: Config.WEB_GOOGLE_CLIENT_ID
})

export default function GoogleLoginButton ({
  signup,
  onLoginFinished,
  createErrorNotification,
  style: providedStyle = {}
} = {}) {
  const { t } = useTranslation()

  const signIn = useCallback(async () => {
    try {
      await GoogleSignin.hasPlayServices()
      await GoogleSignin.signIn()

      const { accessToken } = await GoogleSignin.getTokens()
      onLoginFinished(accessToken)
    } catch (error) {
      if (error.code !== statusCodes.SIGN_IN_CANCELLED) {
        await createErrorNotification(t('Could not sign in with your Google account'))
      }
    }
  }, [onLoginFinished, createErrorNotification])

  const style = {
    fontSize: 16,
    width: 160,
    height: 40,
    borderRadius: 5,
    backgroundColor: Colors.destructive,
    ...providedStyle,
    icon: {
      fontSize: 16,
      marginRight: 3,
      ...providedStyle?.icon ? providedStyle.icon : {}
    }
  }

  const text = signup
    ? t('Sign up with Google')
    : t('Sign in with Google')

  return (
    <Button
      onPress={signIn}
      iconName='Google'
      style={style}
      text={text}
    />
  )
}
