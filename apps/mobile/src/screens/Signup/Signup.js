import React, { useCallback, useState } from 'react'
import { View, Text, Image, ImageBackground, TouchableOpacity, ScrollView, TextInput } from 'react-native'
import { useMutation } from 'urql'
import { useTranslation } from 'react-i18next'
import { useNavigation, useFocusEffect } from '@react-navigation/native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import validator from 'validator'
import { AnalyticsEvents } from '@hylo/shared'
import { useAuth } from '@hylo/contexts/AuthContext'
import sendEmailVerificationMutation from '@hylo/graphql/mutations/sendEmailVerificationMutation'
import mixpanel from 'services/mixpanel'
import { openURL } from 'hooks/useOpenURL'
import useRouteParams from 'hooks/useRouteParams'
import FormattedError from 'components/FormattedError'
import KeyboardFriendlyView from 'components/KeyboardFriendlyView'
import Button from 'components/Button'
import SocialAuth from 'components/SocialAuth'
import providedStyles from './Signup.styles'

const backgroundImage = require('assets/signin_background.png')
const merkabaImage = require('assets/merkaba_white.png')

function useSignupWorkflow () {
  const navigation = useNavigation()
  const routeParams = useRouteParams()
  const { step, email } = routeParams
  const { currentUser, fetching } = useAuth()

  useFocusEffect(
    useCallback(() => {
      if (fetching) return
      if (currentUser?.settings?.signupInProgress) {
        if (!currentUser.emailValidated) {
          navigation.navigate('SignupEmailValidation', routeParams)
        } else if (!currentUser.hasRegistered) {
          navigation.navigate('SignupRegistration', routeParams)
        } else if (!currentUser?.avatarUrl || currentUser.avatarUrl?.startsWith('https://www.gravatar.com/avatar/')) {
          navigation.navigate('SignupUploadAvatar', routeParams)
        } else {
          navigation.navigate('SignupSetLocation', routeParams)
        }
      } else if (step === 'verify-email' && email) {
        navigation.navigate('SignupEmailValidation', routeParams)
      }
    }, [
      currentUser?.settings?.signupInProgress,
      currentUser?.emailValidated,
      currentUser?.hasRegistered,
      currentUser?.avatarUrl,
      fetching,
      step
    ])
  )

  return { currentUser, fetching }
}

export default function Signup () {
  const { t } = useTranslation()
  const navigation = useNavigation()
  const safeAreaInsets = useSafeAreaInsets()
  const { email: routeEmail, error: routeError, bannerError: routeBannerError } = useRouteParams()
  const { fetching } = useSignupWorkflow()
  const [, sendEmailVerification] = useMutation(sendEmailVerificationMutation)
  const [email, providedSetEmail] = useState(routeEmail)
  const [signingUp, setSigningUp] = useState(false)
  const [error, setError] = useState(routeError)
  // TODO: Positive message for `checkInvitation` result
  // const [message, setMessage] = useState(routeParams?.message)
  const [bannerError, setBannerError] = useState()
  const [canSubmit, setCanSubmit] = useState(!fetching && !signingUp && email)
  const genericError = new Error(t('An account may already exist for this email address, Login or try resetting your password'))

  useFocusEffect(
    useCallback(() => {
      setBannerError(routeBannerError)
    }, [routeBannerError])
  )

  const setEmail = validateEmail => {
    setBannerError()
    setError()
    setCanSubmit(!!validator.isEmail(validateEmail))
    providedSetEmail(validateEmail)
  }

  const handleSocialAuthStart = () => {
    setSigningUp(true)
  }

  const handleSocialAuthComplete = socialAuthError => {
    if (socialAuthError) setBannerError(socialAuthError)
    setSigningUp(false)
  }

  const submit = async () => {
    try {
      setSigningUp(true)

      const { data } = await sendEmailVerification({ email })

      if (data?.sendEmailVerification?.success) {
        mixpanel.track(AnalyticsEvents.SIGNUP_EMAIL_VERIFICATION_SENT, { email })
        openURL(`/signup/verify-email?email=${encodeURIComponent(email)}`)
      } else {
        throw genericError
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setSigningUp(false)
    }
  }

  const styles = {
    ...providedStyles,
    background: {
      ...providedStyles.background,
      height: providedStyles.background.height + safeAreaInsets.top
    },
    backgroundImage: {
      ...providedStyles.backgroundImage,
      height: providedStyles.backgroundImage.height + safeAreaInsets.top
    }
  }

  if (fetching) return null

  return (
    <KeyboardFriendlyView style={styles.container}>
      <ScrollView>
        {signingUp && <Text style={styles.bannerMessage}>{t('SIGNING UP')}</Text>}
        {bannerError && <Text style={styles.bannerError}>{bannerError}</Text>}

        <ImageBackground
          source={backgroundImage}
          style={styles.background}
          imageStyle={styles.backgroundImage}
        >
          <Image source={merkabaImage} style={styles.merkabaImage} />
          <Text style={styles.title}>{t('Welcome to Hylo')}</Text>
          <Text style={styles.subTitle}>{t('Stay connected, organized, and engaged with your group')}.</Text>
        </ImageBackground>
        <View style={styles.content}>
          <Text style={styles.labelText}>{t('Enter your email below to get started!')}</Text>
          <TextInput
            style={styles.textInput}
            returnKeyType='go'
            onSubmitEditing={canSubmit ? submit : () => {}}
            value={email}
            onChangeText={value => setEmail(value)}
            keyboardType='email-address'
            autoCapitalize='none'
            autoCorrect={false}
            underlineColorAndroid='transparent'
          />
          <FormattedError styles={styles} error={error} action='Signup' />
          <Button
            style={styles.signupButton}
            text={signingUp ? t('Saving-ellipsis') : t('Continue')}
            onPress={submit}
            disabled={!canSubmit}
          />
          <SocialAuth onStart={handleSocialAuthStart} onComplete={handleSocialAuthComplete} forSignup />
          <View style={styles.login}>
            <Text style={styles.haveAccount}>{t('Already have an account?')} </Text>
            <TouchableOpacity onPress={() => navigation.navigate('Login')}>
              <Text style={styles.loginButton}>{t('Log in now')}</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.terms}>
            <Text style={{ ...styles.haveAccount, ...styles.termsText }}>
              {t('Your data is safe with Hylo By clicking the Sign Up button above you are agreeing to these terms:')}
            </Text>
            <TouchableOpacity onPress={() => openURL('https://www.hylo.com/terms')}>
              <Text style={{ ...styles.loginButton, ...styles.termsText }}>{t('Terms of Service + Privacy Policy')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </KeyboardFriendlyView>
  )
}
