import React from 'react'
import { Text, View } from 'react-native'
import { useTranslation } from 'react-i18next'
import { useAuth } from '@hylo/contexts/AuthContext'
import { isIOS } from '../../util/platform'
import useAuthStore from '../../store/authStore'
import AppleLoginButton from './AppleLoginButton'
import GoogleLoginButton from './GoogleLoginButton'
import { rhino60 } from '@hylo/presenters/colors'

export default function SocialAuth ({
  onStart: providedOnStart,
  onComplete: providedOnComplete,
  forSignup
}) {
  const { t } = useTranslation()
  const { loginWithApple, loginWithGoogle } = useAuthStore()
  const { checkAuth } = useAuth()

  const handleOnStart = async () => {
    await providedOnStart()
  }

  const handleOnComplete = async error => {
    await providedOnComplete(error)
    await checkAuth()
  }

  const socialLoginMaker = loginWith => async token => {
    try {
      handleOnStart()

      const response = await loginWith(token)

      if (response.error) {
        const errorMessage = response?.payload?.response?.body

        if (errorMessage) {
          throw new Error(errorMessage)
        }
      } else {
        await handleOnComplete()
      }
    } catch (e) {
      await handleOnComplete(e.message)
    }
  }

  return (
    <View style={styles.connectWith}>
      <Text style={styles.connectWithText}>{t('Or connect with')}:</Text>
      {isIOS && (
        <AppleLoginButton
          style={styles.socialLoginButton}
          onLoginFinished={socialLoginMaker(loginWithApple)}
          createErrorNotification={handleOnComplete}
          signup={forSignup}
        />
      )}
      <GoogleLoginButton
        style={styles.socialLoginButton}
        onLoginFinished={socialLoginMaker(loginWithGoogle)}
        createErrorNotification={handleOnComplete}
        signup={forSignup}
      />
    </View>
  )
}

const styles = {
  // Connect with:
  connectWith: {
    marginTop: 10,
    display: 'flex',
    alignItems: 'center'
  },
  connectWithText: {
    fontFamily: 'Circular-Book',
    fontSize: 14,
    color: rhino60,
    textAlign: 'center',
    marginBottom: 15
  },
  socialLoginButton: {
    minWidth: '65%',
    marginBottom: 10
  }
}