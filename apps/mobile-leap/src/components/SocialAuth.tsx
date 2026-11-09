import Constants from 'expo-constants'
import { Platform, Text, View } from 'react-native'
import { useTranslation } from 'react-i18next'
import * as AppleAuthentication from 'expo-apple-authentication'
import { useAuth } from '@hylo/contexts/AuthContext'
import { loginWithApple, loginWithGoogle } from 'util/authApi'
import { saveTokens } from 'util/tokenStore'
import { authLog } from 'util/authDebug'
import GoogleLoginButton from './GoogleLoginButton'
import { IOS_GOOGLE_CLIENT_ID, WEB_GOOGLE_CLIENT_ID } from 'config'

type SocialAuthProps = {
  onStart?: () => void
  onComplete?: (error?: string) => void | Promise<void>
  forSignup?: boolean
}

const isExpoGo = Constants.appOwnership === 'expo'

export default function SocialAuth ({ onStart, onComplete, forSignup }: SocialAuthProps) {
  const { t } = useTranslation()
  const { checkAuth } = useAuth()

  const finish = async (error?: string) => {
    await onComplete?.(error)
    if (!error) await checkAuth()
  }

  const handleApple = async () => {
    try {
      onStart?.()
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL
        ]
      })
      const payload = await loginWithApple({
        user: credential.user,
        identityToken: credential.identityToken,
        email: credential.email,
        fullName: credential.fullName
      })
      if (payload?.access_token) {
        await saveTokens(payload)
        authLog('SocialAuth Apple: tokens saved')
      }
      await finish()
    } catch (err) {
      const code = (err as { code?: string }).code
      if (code === 'ERR_REQUEST_CANCELED') return finish()
      await finish(t('Could not sign in with your Apple account'))
    }
  }

  const handleGoogle = async () => {
    if (isExpoGo) {
      await finish('Google Sign-In requires a development build (not Expo Go)')
      return
    }
    try {
      onStart?.()
      const { GoogleSignin } = await import('@react-native-google-signin/google-signin')
      GoogleSignin.configure({
        iosClientId: IOS_GOOGLE_CLIENT_ID,
        webClientId: WEB_GOOGLE_CLIENT_ID
      })
      await GoogleSignin.hasPlayServices()
      await GoogleSignin.signIn()
      const { accessToken } = await GoogleSignin.getTokens()
      const payload = await loginWithGoogle(accessToken)
      if (payload?.access_token) {
        await saveTokens(payload)
        authLog('SocialAuth Google: tokens saved')
      }
      await finish()
    } catch (err) {
      await finish(t('Could not sign in with your Google account'))
    }
  }

  return (
    <View className='mt-4 items-center'>
      <Text className='mb-3 text-sm text-muted-foreground'>{t('Or connect with')}:</Text>
      {Platform.OS === 'ios' && (
        <AppleAuthentication.AppleAuthenticationButton
          buttonType={forSignup
            ? AppleAuthentication.AppleAuthenticationButtonType.SIGN_UP
            : AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
          buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
          cornerRadius={8}
          style={{ width: 260, height: 44, marginBottom: 10 }}
          onPress={handleApple}
        />
      )}
      {!isExpoGo && (
        <GoogleLoginButton
          text={forSignup ? t('Sign up with Google') : t('Sign in with Google')}
          onPress={handleGoogle}
        />
      )}
      {isExpoGo && Platform.OS === 'android' && (
        <Text className='text-center text-xs text-muted-foreground'>
          Google Sign-In available in dev build only
        </Text>
      )}
    </View>
  )
}
