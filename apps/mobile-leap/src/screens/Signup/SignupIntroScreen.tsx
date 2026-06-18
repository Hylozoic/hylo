import { useCallback, useState } from 'react'
import { Image } from 'expo-image'
import { ScrollView, Text, TextInput, Pressable, View } from 'react-native'
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
import Button from '../../components/Button'
import FormattedError from '../../components/FormattedError'
import SocialAuth from '../../components/SocialAuth'
import validator from 'validator'

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
  const { fetching } = useSignupWorkflow()
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

  if (fetching) return null

  return (
    <View className='flex-1 bg-background' style={{ paddingBottom: insets.bottom }}>
      <ScrollView className='flex-1'>
        {bannerError && (
          <Text className='bg-destructive px-4 py-2 text-destructive-foreground' style={{ paddingTop: insets.top }}>
            {bannerError}
          </Text>
        )}
        {!bannerError && signingUp && (
          <Text className='bg-selected px-4 py-2 text-foreground' style={{ paddingTop: insets.top }}>
            {t('SIGNING UP')}
          </Text>
        )}

        <View className='items-center bg-secondary px-6 pb-8 pt-12'>
          <Image source={require('../../../assets/icon.png')} style={{ width: 64, height: 64 }} contentFit='contain' />
          <Text className='mt-4 text-2xl font-bold text-secondary-foreground'>{t('Welcome to Hylo')}</Text>
          <Text className='mt-2 text-center text-secondary-foreground/90'>
            {t('Stay connected, organized, and engaged with your group')}.
          </Text>
        </View>

        <View className='px-6 py-6'>
          <Text className='mb-3 text-foreground'>{t('Enter your email below to get started!')}</Text>
          <TextInput
            className='mb-4 rounded-lg border border-border bg-card px-3 py-3 text-foreground'
            value={email}
            onChangeText={setEmail}
            keyboardType='email-address'
            autoCapitalize='none'
            returnKeyType='go'
            onSubmitEditing={canSubmit ? submit : undefined}
          />
          <FormattedError error={error} action='Signup' />
          <Button
            text={signingUp ? t('Saving-ellipsis') : t('Continue')}
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
            <Text className='text-muted-foreground'>{t('Already have an account?')} </Text>
            <Pressable onPress={() => navigation.replace('Login' as never)}>
              <Text className='font-semibold text-secondary'>{t('Log in now')}</Text>
            </Pressable>
          </View>
        </View>
      </ScrollView>
    </View>
  )
}
