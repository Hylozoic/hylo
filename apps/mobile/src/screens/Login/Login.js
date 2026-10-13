import React, { useCallback, useRef, useState } from 'react'
import { ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native'
import { useTranslation } from 'react-i18next'
import { useFocusEffect, useNavigation } from '@react-navigation/native'
import FastImage from 'react-native-fast-image'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import EntypoIcon from 'react-native-vector-icons/Entypo'
import { useAuth } from '@hylo/contexts/AuthContext'
import useRouteParams from 'hooks/useRouteParams'
import validator from 'validator'
import errorMessages from 'util/errorMessages'
import SocialAuth from 'components/SocialAuth'
import FormattedError from 'components/FormattedError'
import LocaleSelector from 'components/LocaleSelector'
import styles from './Login.styles'

export default function Login () {
  const insets = useSafeAreaInsets()
  const { t } = useTranslation()
  const navigation = useNavigation()
  const passwordInputRef = useRef()
  const { login } = useAuth()
  const [email, providedSetEmail] = useState()
  const [password, providedSetPassword] = useState()
  const [securePassword, setSecurePassword] = useState(true)
  const [emailIsValid, setEmailIsValid] = useState()
  const [bannerError, setBannerError] = useState()
  const [bannerMessage, setBannerMessage] = useState()
  const [formError, providedSetFormError] = useState()
  const { bannerMessage: bannerMessageParam, bannerError: bannerErrorParam } = useRouteParams()

  const setFormError = error => {
    const type = error?.message || error
    providedSetFormError(errorMessages(type))
  }

  const setLoggingIn = status => {
    if (status) {
      setBannerMessage(t('LOGGING IN'))
    } else {
      setBannerMessage()
    }
  }

  const clearErrors = useCallback(() => {
    setFormError()
    setBannerError()
    setBannerMessage()
  }, [])

  useFocusEffect(
    useCallback(() => {
      clearErrors()
      if (bannerErrorParam) setBannerError(errorMessages(bannerErrorParam))
      if (bannerMessageParam) setBannerMessage(bannerMessageParam)
    }, [bannerErrorParam, bannerMessageParam, clearErrors])
  )

  const setEmail = validateEmail => {
    clearErrors()
    setEmailIsValid(validator.isEmail(validateEmail))
    providedSetEmail(validateEmail)
  }

  const setPassword = passwordValue => {
    clearErrors()
    providedSetPassword(passwordValue)
  }

  const handleLogin = async () => {
    try {
      setLoggingIn(true)
      await login({ email, password })
    } catch (err) {
      setLoggingIn(false)
      setFormError(err)
    }
  }

  const handleSocialAuthStart = () => {
    setLoggingIn(true)
  }

  const handleSocialAuthComplete = async error => {
    if (error) setBannerError(error)
    setLoggingIn(false)
  }

  const togglePassword = () => {
    setSecurePassword(!securePassword)
  }

  const goToSignup = () => navigation.navigate('Signup')

  const goToResetPassword = () => navigation.navigate('ForgotPassword')

  return (
    <View style={{ flex: 1, paddingBottom: insets.bottom, paddingRight: insets.right, paddingLeft: insets.left }}>
      <ScrollView contentContainerStyle={styles.login} style={styles.container}>
        <View style={styles.localeContainer}>
          <View style={styles.localeContents}>
            <LocaleSelector />
          </View>
        </View>

        {bannerError && (
          <Text style={[styles.banner, styles.bannerError, { paddingTop: insets.top }]}>
            {bannerError}
          </Text>
        )}

        {(!bannerError && bannerMessage) && (
          <Text style={[styles.banner, styles.bannerMessage, { paddingTop: insets.top }]}>
            {bannerMessage}
          </Text>
        )}

        <FastImage
          style={styles.logo}
          source={require('assets/merkaba-green-on-white.png')}
        />
        <Text style={styles.title}>{t('Log in to Hylo')}</Text>
        <View style={styles.labelRow}>
          <Text style={styles.labelText}>{t('Email address')}</Text>
        </View>
        <View style={styles.paddedRow}>
          <View style={emailIsValid ? styles.paddedBorderValid : styles.paddedBorder}>
            <View style={styles.leftInputView}>
              <TextInput
                style={styles.textInput}
                onChangeText={setEmail}
                returnKeyType='next'
                autoCapitalize='none'
                autoCorrect={false}
                keyboardType='email-address'
                onSubmitEditing={() => passwordInputRef.current.focus()}
                underlineColorAndroid='transparent'
              />
            </View>
            <View style={styles.rightIconView}>
              {emailIsValid && (
                <EntypoIcon name='check' style={styles.iconGreen} />
              )}
            </View>
          </View>
        </View>
        <View style={styles.labelRow}>
          <Text style={styles.labelText}>{t('Password')}</Text>
          <TouchableOpacity onPress={goToResetPassword}>
            <Text style={styles.forgotPasswordText}>{t('Forgot your password?')}</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.paddedRow}>
          <View style={styles.paddedBorder}>
            <View style={styles.leftInputView}>
              <TextInput
                style={styles.textInput}
                secureTextEntry={securePassword}
                autoCapitalize='none'
                ref={passwordInputRef}
                onChangeText={setPassword}
                returnKeyType='go'
                selectTextOnFocus
                onSubmitEditing={() => handleLogin()}
                underlineColorAndroid='transparent'
              />
            </View>
            <View style={styles.rightIconView}>
              <EntypoIcon
                name={securePassword ? 'eye' : 'eye-with-line'}
                style={styles.iconOpaque}
                onPress={togglePassword}
              />
            </View>
          </View>
        </View>
        <FormattedError error={formError} action='Login' />
        <View style={styles.paddedRow}>
          <TouchableOpacity onPress={handleLogin} disabled={!emailIsValid} style={styles.loginButton}>
            <Text style={styles.loginText}>{t('Log In')}</Text>
          </TouchableOpacity>
        </View>
        <SocialAuth onStart={handleSocialAuthStart} onComplete={handleSocialAuthComplete} />
        <SignupLink goToSignup={goToSignup} />
      </ScrollView>
    </View>
  )
}

export function SignupLink ({ goToSignup }) {
  const { t } = useTranslation()
  return (
    <View style={styles.signup}>
      <Text style={styles.signupText}>{t('Dont have an account?')} </Text>
      <TouchableOpacity onPress={goToSignup}>
        <Text style={styles.signupLink}>{t('Sign up now')}</Text>
      </TouchableOpacity>
    </View>
  )
}

// NOTE: This works, but I don't trust it and it could/should probably be moved
//       into a modal at the level of the `RootNavigator`
// import NetInfo from '@react-native-community/netinfo'
// const [isConnected, setIsConnected] = useState()
// useFocusEffect(
//   useCallback(() => {
//     const handleConnectivityChange = ({ isConnected: isConnectedParam }) => {
//       if (isConnectedParam !== isConnected) {
//         setIsConnected(isConnectedParam)
//         setBannerError(!isConnectedParam ? 'OFFLINE; TRYING TO RECONNECT...' : null)
//       }
//     }

//     return NetInfo.addEventListener(handleConnectivityChange)
//   }, [isConnected])
// )
