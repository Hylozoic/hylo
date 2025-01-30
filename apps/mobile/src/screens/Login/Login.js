import React, { useCallback, useRef, useState } from 'react'
import { useSelector } from 'react-redux'
import { ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native'
import { useTranslation } from 'react-i18next'
import { useFocusEffect, useNavigation } from '@react-navigation/native'
import FastImage from 'react-native-fast-image'
import { SafeAreaView } from 'react-native-safe-area-context'
import EntypoIcon from 'react-native-vector-icons/Entypo'
import { useAuth } from 'frontend-shared/contexts/contexts/AuthContext'
import useRouteParams from 'hooks/useRouteParams'
import validator from 'validator'
import errorMessages from 'util/errorMessages'
import SocialAuth from 'components/SocialAuth'
import styles from './Login.styles'
import LocaleSelector from 'components/LocaleSelector/LocaleSelector'

export default function Login () {
  const { t } = useTranslation()
  const navigation = useNavigation()
  const passwordInputRef = useRef()
  const { login, checkAuth } = useAuth()
  const defaultLoginEmail = useSelector(state => state.session?.defaultLoginEmail)

  const [email, providedSetEmail] = useState(defaultLoginEmail)
  const [password, providedSetPassword] = useState()
  const [securePassword, setSecurePassword] = useState(true)
  const [emailIsValid, setEmailIsValid] = useState()
  const [bannerError, setBannerError] = useState()
  const [bannerMessage, setBannerMessage] = useState()
  const [formError, setFormError] = useState()
  const { bannerMessage: bannerMessageParam, bannerError: bannerErrorParam } = useRouteParams()

  const setError = errorMessage => {
    setFormError(errorMessages(errorMessage))
  }

  const setLoggingIn = status => {
    if (status) {
      setBannerMessage(t('LOGGING IN'))
    } else {
      setBannerMessage()
    }
  }

  const clearErrors = useCallback(() => {
    setError()
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
      setError(err)
    }
  }

  const handleSocialAuthStart = () => {
    setLoggingIn(true)
  }

  const handleSocialAuthComplete = async error => {
    if (error) setBannerError(error)
    await checkAuth()
    setLoggingIn(false)
  }

  const togglePassword = () => {
    setSecurePassword(!securePassword)
  }

  const goToSignup = () => navigation.navigate('Signup')

  const goToResetPassword = () => navigation.navigate('ForgotPassword')

  return (
    <SafeAreaView style={{ flex: 1 }} edges={['bottom', 'left', 'right']}>
      <ScrollView contentContainerStyle={styles.login} style={styles.container}>
        <View style={styles.localeContainer}>
          <View style={styles.localeContents}>
            <LocaleSelector />
          </View>
        </View>

        {bannerError && <Text style={styles.bannerError}>{bannerError}</Text>}
        {(!bannerError && bannerMessage) && <Text style={styles.bannerMessage}>{bannerMessage}</Text>}

        <FastImage
          style={styles.logo}
          source={require('assets/merkaba-green-on-white.png')}
        />
        <Text style={styles.title}>{t('Log in to Hylo')}</Text>
        <FormError>{formError}</FormError>
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
        <View style={styles.paddedRow}>
          <TouchableOpacity onPress={handleLogin} disabled={!emailIsValid} style={styles.loginButton}>
            <Text style={styles.loginText}>{t('Log In')}</Text>
          </TouchableOpacity>
        </View>
        <SocialAuth onStart={handleSocialAuthStart} onComplete={handleSocialAuthComplete} />
        <SignupLink goToSignup={goToSignup} />
      </ScrollView>
    </SafeAreaView>
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

export function FormError ({ children }) {
  const rowStyle = styles.emailErrorRow
  const triangleStyle = styles.emailTriangle

  if (!children) return null

  return (
    <View style={styles.errorView}>
      <View style={rowStyle}>
        <Text style={styles.errorMessage}>{children}</Text>
      </View>
      <View style={triangleStyle} />
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
