import { useCallback, useState } from 'react'
import { Image } from 'expo-image'
import { Dimensions, ImageBackground, Pressable, ScrollView, Text, TextInput, View } from 'react-native'
import { useMutation } from 'urql'
import { useTranslation } from 'react-i18next'
import { useFocusEffect, useNavigation } from '@react-navigation/native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { AnalyticsEvents } from '@hylo/shared'
import { useAuth } from '@hylo/contexts/AuthContext'
import sendEmailVerificationMutation from '@hylo/graphql/mutations/sendEmailVerificationMutation'
import { trackWithConsent } from '../../services/mixpanel'
import useOpenURL from '../../hooks/useOpenURL'
import useRouteParams from '../../hooks/useRouteParams'
import FormattedError from '../../components/FormattedError'
import SocialAuth from '../../components/SocialAuth'
import { AuthBanner, AuthPrimaryButton } from '../../components/auth/AuthScreenParts'
import KeyboardFriendlyView from '../../components/KeyboardFriendlyView'
import LocaleSelector from '../../components/LocaleSelector'
import { isIOS } from '../../util/platform'
import validator from 'validator'

const signinBackground = require('../../../assets/signin_background.png')
const merkabaWhite = require('../../../assets/merkaba_white.png')
const heroHeight = Dimensions.get('window').height * 0.25 + (isIOS ? 20 : 60)

function useSignupWorkflow () {
  const navigation = useNavigation()
  const routeParams = useRouteParams<{ step?: string, email?: string }>()
  const { step, email } = routeParams
  const { currentUser, fetching } = useAuth()

  useFocusEffect(
    useCallback(() => {
      if (fetching) return
      if (currentUser?.settings?.signupInProgress) {
        if (!currentUser.emailValidated) {
          navigation.navigate('SignupEmailValidation' as never, routeParams as never)
        } else if (!currentUser.hasRegistered) {
          navigation.navigate('SignupRegistration' as never)
        } else if (!currentUser.avatarUrl || currentUser.avatarUrl.startsWith('https://www.gravatar.com/avatar/')) {
          navigation.navigate('SignupUploadAvatar' as never)
        } else {
          navigation.navigate('SignupSetLocation' as never)
        }
      } else if (step === 'verify-email' && email) {
        navigation.navigate('SignupEmailValidation' as never, routeParams as never)
      }
    }, [
      currentUser?.settings?.signupInProgress,
      currentUser?.emailValidated,
      currentUser?.hasRegistered,
      currentUser?.avatarUrl,
      fetching,
      step,
      email,
      navigation,
      routeParams
    ])
  )
}

export default function SignupIntroScreen () {
  const { t } = useTranslation()
  const insets = useSafeAreaInsets()
  const navigation = useNavigation()
  const openURL = useOpenURL()
  useSignupWorkflow()
  const [, sendEmailVerification] = useMutation(sendEmailVerificationMutation)
  const { email: routeEmail, error: routeError, bannerError: routeBannerError } = useRouteParams<{
    email?: string
    error?: string
    bannerError?: string
  }>()
  const [email, setEmailState] = useState(routeEmail ?? '')
  const [signingUp, setSigningUp] = useState(false)
  const [error, setError] = useState(routeError)
  const [bannerError, setBannerError] = useState(routeBannerError)
  const [canSubmit, setCanSubmit] = useState(!!routeEmail && validator.isEmail(routeEmail ?? ''))

  useFocusEffect(
    useCallback(() => {
      setBannerError(routeBannerError)
    }, [routeBannerError])
  )

  const setEmail = (value: string) => {
    setBannerError(undefined)
    setError(undefined)
    setCanSubmit(validator.isEmail(value))
    setEmailState(value)
  }

  const submit = async () => {
    try {
      setSigningUp(true)
      const { data } = await sendEmailVerification({ email })
      if (data?.sendEmailVerification?.success) {
        trackWithConsent(AnalyticsEvents.SIGNUP_EMAIL_VERIFICATION_SENT, { email })
        openURL(`/signup/verify-email?email=${encodeURIComponent(email)}`)
      } else {
        throw new Error(t('An account may already exist for this email address, Login or try resetting your password'))
      }
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setSigningUp(false)
    }
  }

  return (
    <KeyboardFriendlyView className='flex-1 bg-white' style={{ paddingBottom: insets.bottom }}>
      {bannerError && <AuthBanner message={bannerError} variant='error' topInset={insets.top} />}
      {!bannerError && signingUp && <AuthBanner message={t('SIGNING UP')} topInset={insets.top} />}

      <View className='absolute left-3 z-20' style={{ top: insets.top + 8 }}>
        <LocaleSelector compact />
      </View>

      <ScrollView className='flex-1' keyboardShouldPersistTaps='handled'>
        <ImageBackground
          source={signinBackground}
          style={{ width: '100%', height: heroHeight + insets.top, justifyContent: 'flex-end', alignItems: 'center', paddingBottom: 20 }}
          imageStyle={{ height: heroHeight + insets.top, resizeMode: 'cover' }}
        >
          <Image source={merkabaWhite} style={{ width: 97, height: 97 }} contentFit='contain' />
          <Text className='mt-4 text-2xl font-bold text-white'>{t('Welcome to Hylo')}</Text>
          <Text className='mt-2 px-[20%] text-center text-base text-white/90'>
            {t('Stay connected, organized, and engaged with your group')}.
          </Text>
        </ImageBackground>

        <View className='px-6 py-6'>
          <Text className='mb-3 text-foreground/80'>{t('Enter your email below to get started!')}</Text>
          <TextInput
            className='mb-4 rounded-md border border-border px-3 py-3 text-base text-foreground'
            value={email}
            onChangeText={setEmail}
            keyboardType='email-address'
            autoCapitalize='none'
            returnKeyType='go'
            onSubmitEditing={canSubmit ? submit : undefined}
          />
          <FormattedError error={error} action='Signup' />
          <AuthPrimaryButton
            label={signingUp ? t('Saving-ellipsis') : t('Continue')}
            onPress={submit}
            disabled={!canSubmit || signingUp}
          />
          <SocialAuth
            forSignup
            onStart={() => setSigningUp(true)}
            onComplete={(err) => {
              if (err) setBannerError(err)
              setSigningUp(false)
            }}
          />
          <View className='mt-6 flex-row justify-center'>
            <Text className='text-foreground/70'>{t('Already have an account?')} </Text>
            <Pressable onPress={() => navigation.replace('Login' as never)}>
              <Text className='font-bold text-selected'>{t('Log in now')}</Text>
            </Pressable>
          </View>
          <View className='mt-8'>
            <Text className='text-center text-sm text-foreground/70'>
              {t('Your data is safe with Hylo By clicking the Sign Up button above you are agreeing to these terms:')}
            </Text>
            <Pressable onPress={() => openURL('https://www.hylo.com/terms')}>
              <Text className='mt-2 text-center text-sm font-bold text-selected'>
                {t('Terms of Service + Privacy Policy')}
              </Text>
            </Pressable>
          </View>
        </View>
      </ScrollView>
    </KeyboardFriendlyView>
  )
}
