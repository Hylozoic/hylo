import { useCallback, useEffect, useState } from 'react'
import { ScrollView, Text, TextInput, Pressable, View } from 'react-native'
import { useFocusEffect, useNavigation } from '@react-navigation/native'
import { useTranslation } from 'react-i18next'
import { gql, useMutation } from 'urql'
import { CodeField, Cursor, useBlurOnFulfill, useClearByFocusCell } from 'react-native-confirmation-code-field'
import { AnalyticsEvents } from '@hylo/shared'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useAuth } from '@hylo/contexts/AuthContext'
import meAuthFieldsFragment from '@hylo/graphql/fragments/meAuthFieldsFragment'
import sendEmailVerificationMutation from '@hylo/graphql/mutations/sendEmailVerificationMutation'
import updateUserSettingsMutation from '@hylo/graphql/mutations/updateUserSettingsMutation'
import useRouteParams from '../../hooks/useRouteParams'
import { trackWithConsent } from '../../services/mixpanel'
import errorMessages from 'util/errorMessages'
import FormattedError from '../../components/FormattedError'

const CODE_LENGTH = 6

const verifyEmailMutation = gql`
  mutation VerifyEmailMutation($email: String!, $code: String, $token: String) {
    verifyEmail(email: $email, code: $code, token: $token) {
      me { ...MeAuthFieldsFragment }
      error
    }
  }
  ${meAuthFieldsFragment}
`

const registerMutation = gql`
  mutation RegisterMutation ($name: String!, $password: String!) {
    register(name: $name, password: $password) {
      me { id name email }
    }
  }
`

export function SignupEmailValidationScreen () {
  const insets = useSafeAreaInsets()
  const { t } = useTranslation()
  const navigation = useNavigation()
  const { email, token } = useRouteParams<{ email?: string, token?: string }>()
  const [, verifyEmail] = useMutation(verifyEmailMutation)
  const [, sendEmailVerification] = useMutation(sendEmailVerificationMutation)
  const [loading, setLoading] = useState(false)
  const [verificationCode, setVerificationCode] = useState('')
  const [error, setError] = useState<string>()
  const verificationCodeRef = useBlurOnFulfill({ value: verificationCode, cellCount: CODE_LENGTH })
  const [props, getCellOnLayoutHandler] = useClearByFocusCell({
    value: verificationCode,
    setValue: setVerificationCode
  })

  const handleVerify = useCallback(async () => {
    if (!email) return
    try {
      setLoading(true)
      const response = await verifyEmail({ email, code: verificationCode, token })
      const responseError = response?.data?.verifyEmail?.error
      if (responseError) {
        if (responseError === 'invalid-link') {
          navigation.replace('Signup Intro' as never, { bannerError: errorMessages(responseError) } as never)
          return
        }
        setError(responseError)
      } else {
        trackWithConsent(AnalyticsEvents.SIGNUP_EMAIL_VERIFIED, { email })
        navigation.navigate('SignupRegistration' as never)
      }
    } catch {
      setError(t('Expired or invalid code'))
    } finally {
      setLoading(false)
    }
  }, [email, verificationCode, token, verifyEmail, navigation, t])

  useFocusEffect(
    useCallback(() => {
      if (!email) navigation.replace('Signup' as never)
      if (token) handleVerify()
    }, [email, token, navigation, handleVerify])
  )

  useEffect(() => {
    setError(undefined)
    if (verificationCode.length === CODE_LENGTH) handleVerify()
  }, [verificationCode, handleVerify])

  const resendCode = async () => {
    try {
      setLoading(true)
      await sendEmailVerification({ email })
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <View className='flex-1 bg-background px-6' style={{ paddingTop: insets.top, paddingBottom: insets.bottom }}>
      <ScrollView keyboardShouldPersistTaps='handled'>
        <Text className='mb-2 text-2xl font-semibold text-foreground'>{t('Check your email')}</Text>
        <Text className='text-muted-foreground'>{t('Weve sent a 6 digit code to')}:</Text>
        <Text className='my-2 font-bold text-foreground'>{email}</Text>
        <CodeField
          ref={verificationCodeRef}
          {...props}
          value={verificationCode}
          onChangeText={setVerificationCode}
          cellCount={CODE_LENGTH}
          keyboardType='number-pad'
          editable={!loading}
          textContentType='oneTimeCode'
          renderCell={({ index, symbol, isFocused }) => (
            <Text
              key={index}
              className={`mx-1 h-12 w-10 rounded border text-center text-xl leading-[48px] text-foreground ${isFocused ? 'border-secondary' : 'border-border'}`}
              onLayout={getCellOnLayoutHandler(index)}
            >
              {symbol || (isFocused ? <Cursor /> : ' ')}
            </Text>
          )}
        />
        <Pressable className='mt-4' onPress={resendCode} disabled={loading}>
          <Text className='text-secondary'>{t('Resend code')}</Text>
        </Pressable>
        <FormattedError error={error} />
      </ScrollView>
    </View>
  )
}

export function SignupRegistrationScreen () {
  const insets = useSafeAreaInsets()
  const { t } = useTranslation()
  const navigation = useNavigation()
  const { currentUser } = useAuth()
  const [name, setName] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string>()
  const [, register] = useMutation(registerMutation)

  const handleSubmit = async () => {
    if (password.length < 9) {
      setError(t('Password must be at least 9 characters'))
      return
    }
    if (password !== confirmPassword) {
      setError(t('Passwords must match'))
      return
    }
    try {
      setLoading(true)
      await register({ name, password })
      trackWithConsent(AnalyticsEvents.SIGNUP_REGISTERED, {})
      navigation.navigate('SignupUploadAvatar' as never)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <View className='flex-1 bg-background px-6' style={{ paddingTop: insets.top, paddingBottom: insets.bottom }}>
      <Text className='mb-2 text-2xl font-semibold text-foreground'>{t('Lets do this!')}</Text>
      <Text className='mb-6 text-muted-foreground'>
        {currentUser?.email ?? ''}
      </Text>
      <FormattedError error={error} />
      <Text className='mb-1 text-sm text-muted-foreground'>{t('Your Full Name')}</Text>
      <TextInput className='mb-3 rounded-lg border border-border bg-card px-3 py-3 text-foreground' value={name} onChangeText={setName} />
      <Text className='mb-1 text-sm text-muted-foreground'>{t('Password (at least 9 characters)')}</Text>
      <TextInput className='mb-3 rounded-lg border border-border bg-card px-3 py-3 text-foreground' value={password} onChangeText={setPassword} secureTextEntry />
      <Text className='mb-1 text-sm text-muted-foreground'>{t('Confirm Password')}</Text>
      <TextInput className='mb-3 rounded-lg border border-border bg-card px-3 py-3 text-foreground' value={confirmPassword} onChangeText={setConfirmPassword} secureTextEntry />
      <Pressable className='mt-4 items-center rounded-full bg-selected py-3' onPress={handleSubmit} disabled={loading || !name}>
        <Text className='font-semibold text-foreground'>{loading ? t('Saving-ellipsis') : t('Continue')}</Text>
      </Pressable>
    </View>
  )
}

export function SignupUploadAvatarScreen () {
  const { t } = useTranslation()
  const navigation = useNavigation()

  return (
    <View className='flex-1 items-center justify-center bg-background px-6'>
      <Text className='mb-2 text-xl font-semibold text-foreground'>{t('Upload a Photo')}</Text>
      <Text className='mb-6 text-center text-muted-foreground'>Skip for now — full avatar picker in a follow-up.</Text>
      <Pressable className='w-full items-center rounded-full bg-selected py-3' onPress={() => navigation.navigate('SignupSetLocation' as never)}>
        <Text className='font-semibold text-foreground'>{t('Continue')}</Text>
      </Pressable>
    </View>
  )
}

export function SignupSetLocationScreen () {
  const { t } = useTranslation()
  const [, updateUserSettings] = useMutation(updateUserSettingsMutation)

  const finish = async () => {
    await updateUserSettings({ changes: { settings: { signupInProgress: false } } })
    trackWithConsent(AnalyticsEvents.SIGNUP_COMPLETE, {})
  }

  return (
    <View className='flex-1 items-center justify-center bg-background px-6'>
      <Text className='mb-2 text-xl font-semibold text-foreground'>{t('Add your location')}</Text>
      <Text className='mb-6 text-center text-muted-foreground'>Location picker coming soon — finish signup to enter the app.</Text>
      <Pressable className='w-full items-center rounded-full bg-selected py-3' onPress={finish}>
        <Text className='font-semibold text-foreground'>{t('Finish')}</Text>
      </Pressable>
    </View>
  )
}
