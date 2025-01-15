import React from 'react'
import { useDispatch } from 'react-redux'
import { Text, View } from 'react-native'
import { useTranslation } from 'react-i18next'
import { isIOS } from 'util/platform'
import { loginWithApple, loginWithGoogle } from './actions'
import AppleLoginButton from './AppleLoginButton'
import GoogleLoginButton from './GoogleLoginButton'
import { rhino60 } from 'style/colors'

export default function SocialAuth ({ onStart, onComplete, forSignup }) {
  const { t } = useTranslation()
  const dispatch = useDispatch()

  const socialLoginMaker = loginWith => async token => {
    try {
      onStart()

      const response = await dispatch(loginWith(token))

      if (response.error) {
        const errorMessage = response?.payload?.response?.body

        if (errorMessage) {
          throw new Error(errorMessage)
        }
      } else {
        await onComplete()
      }
    } catch (e) {
      await onComplete(e.message)
    }
  }

  return (
    <View style={styles.connectWith}>
      <Text style={styles.connectWithText}>{t('Or connect with')}:</Text>
      {isIOS && (
        <AppleLoginButton
          style={styles.socialLoginButton}
          onLoginFinished={socialLoginMaker(loginWithApple)}
          createErrorNotification={onComplete}
          signup={forSignup}
        />
      )}
      <GoogleLoginButton
        style={styles.socialLoginButton}
        onLoginFinished={socialLoginMaker(loginWithGoogle)}
        createErrorNotification={onComplete}
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
