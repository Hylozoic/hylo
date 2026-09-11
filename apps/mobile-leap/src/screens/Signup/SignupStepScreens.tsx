import { useCallback, useEffect, useState } from 'react'
import { ActivityIndicator, Pressable, ScrollView, Text, TextInput, View } from 'react-native'
import { Image } from 'expo-image'
import { Entypo } from '@expo/vector-icons'
import { useFocusEffect, useNavigation } from '@react-navigation/native'
import { useTranslation } from 'react-i18next'
import { gql, useMutation } from 'urql'
import { CodeField, Cursor, useBlurOnFulfill, useClearByFocusCell } from 'react-native-confirmation-code-field'
import { AnalyticsEvents, normalizeLocaleToFull } from '@hylo/shared'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useAuth } from '@hylo/contexts/AuthContext'
import meAuthFieldsFragment from '@hylo/graphql/fragments/meAuthFieldsFragment'
import sendEmailVerificationMutation from '@hylo/graphql/mutations/sendEmailVerificationMutation'
import updateUserSettingsMutation from '@hylo/graphql/mutations/updateUserSettingsMutation'
import useRouteParams from '../../hooks/useRouteParams'
import { trackWithConsent } from '../../services/mixpanel'
import errorMessages from 'util/errorMessages'
import FormattedError from '../../components/FormattedError'
import { SignupFlowButton, SignupFlowLayout } from '../../components/auth/AuthScreenParts'
import ImagePicker from '../../components/ImagePicker'
import LocationSelector from '../../components/LocationSelector'
import LoadingScreen from '../../components/LoadingScreen'

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
    <SignupFlowLayout
      title={t('Check your email')}
      subtitle={`${t('Weve sent a 6 digit code to')}: ${email ?? ''}`}
      topInset={insets.top}
      bottomInset={insets.bottom}
    >
      <ScrollView keyboardShouldPersistTaps='handled'>
        <CodeField
          ref={verificationCodeRef}
          {...props}
          value={verificationCode}
          onChangeText={setVerificationCode}
          cellCount={CODE_LENGTH}
          keyboardType='number-pad'
          editable={!loading}
          textContentType='oneTimeCode'
          rootStyle={{ justifyContent: 'center', gap: 10 }}
          renderCell={({ index, symbol, isFocused }) => (
            <Text
              key={index}
              className={`h-12 w-11 rounded border text-center text-xl leading-[48px] text-white ${isFocused ? 'border-white' : 'border-white/40'}`}
              onLayout={getCellOnLayoutHandler(index)}
            >
              {symbol || (isFocused ? <Cursor /> : ' ')}
            </Text>
          )}
        />
        <Pressable className='mt-4' onPress={resendCode} disabled={loading}>
          <Text className='text-white'>{t('Resend code')}</Text>
        </Pressable>
        <FormattedError error={error} />
      </ScrollView>
    </SignupFlowLayout>
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
    <SignupFlowLayout
      title={t('Lets do this!')}
      subtitle={currentUser?.email ?? ''}
      topInset={insets.top}
      bottomInset={insets.bottom}
      footer={(
        <SignupFlowButton
          label={loading ? t('Saving-ellipsis') : t('Continue')}
          onPress={handleSubmit}
          disabled={loading || !name}
        />
      )}
    >
      <FormattedError error={error} />
      <Text className='mb-1 text-sm text-white/80'>{t('Your Full Name')}</Text>
      <TextInput className='mb-3 rounded-lg border border-white/30 bg-white/90 px-3 py-3 text-foreground' value={name} onChangeText={setName} />
      <Text className='mb-1 text-sm text-white/80'>{t('Password (at least 9 characters)')}</Text>
      <TextInput className='mb-3 rounded-lg border border-white/30 bg-white/90 px-3 py-3 text-foreground' value={password} onChangeText={setPassword} secureTextEntry />
      <Text className='mb-1 text-sm text-white/80'>{t('Confirm Password')}</Text>
      <TextInput className='mb-3 rounded-lg border border-white/30 bg-white/90 px-3 py-3 text-foreground' value={confirmPassword} onChangeText={setConfirmPassword} secureTextEntry />
    </SignupFlowLayout>
  )
}

export function SignupUploadAvatarScreen () {
  const insets = useSafeAreaInsets()
  const { t } = useTranslation()
  const navigation = useNavigation()
  const { currentUser, fetching } = useAuth()
  const [, updateUserSettings] = useMutation(updateUserSettingsMutation)
  const [avatarUrl, setAvatarUrl] = useState(currentUser?.avatarUrl)
  const [avatarImageSource, setAvatarImageSource] = useState<{ uri?: string } | null>(
    currentUser?.avatarUrl ? { uri: currentUser.avatarUrl } : null
  )
  const [imagePickerPending, setImagePickerPending] = useState(false)

  const handleAvatarImageUpload = ({ local, remote }: { local: string, remote: string | null }) => {
    setAvatarImageSource({ uri: local })
    setAvatarUrl(remote || local)
  }

  const saveAndNext = async () => {
    await updateUserSettings({ changes: { avatarUrl } })
    navigation.navigate('SignupSetLocation' as never)
  }

  if (fetching) return <LoadingScreen />

  return (
    <SignupFlowLayout
      title={t('Upload a Photo')}
      topInset={insets.top}
      bottomInset={insets.bottom}
      footer={(
        <SignupFlowButton
          label={t('Continue')}
          onPress={saveAndNext}
          disabled={imagePickerPending}
        />
      )}
    >
      <View className='items-center pt-6'>
        <ImagePicker
          type='userAvatar'
          cameraType='front'
          id={currentUser?.id}
          onChoice={handleAvatarImageUpload}
          onPendingChange={setImagePickerPending}
        >
          {avatarImageSource?.uri ? (
            <View className='h-[138px] w-[138px] overflow-hidden rounded-full bg-white/40'>
              <Image
                source={{ uri: avatarImageSource.uri }}
                style={{ width: 138, height: 138 }}
                contentFit='cover'
              />
              {imagePickerPending && (
                <View className='absolute inset-0 items-center justify-center bg-black/30'>
                  <ActivityIndicator color='#fff' size='large' />
                </View>
              )}
            </View>
          ) : (
            <View className='h-[138px] w-[138px] items-center justify-center rounded-full bg-white/40'>
              {imagePickerPending ? <ActivityIndicator color='#fff' size='large' /> : (
                <Entypo name='camera' size={48} color='#ffffff99' />
              )}
            </View>
          )}
        </ImagePicker>
      </View>
    </SignupFlowLayout>
  )
}

export function SignupSetLocationScreen () {
  const insets = useSafeAreaInsets()
  const { t, i18n } = useTranslation()
  const navigation = useNavigation()
  const { currentUser } = useAuth()
  const [locationObject, setLocationObject] = useState<{ id?: string | null, fullText?: string }>()
  const [, updateUserSettings] = useMutation(updateUserSettingsMutation)

  const saveAndFinish = async () => {
    await updateUserSettings({
      changes: {
        location: locationObject?.fullText,
        locationId: locationObject?.id,
        settings: {
          signupInProgress: false,
          locale: normalizeLocaleToFull(i18n.language)
        }
      }
    })
    trackWithConsent(AnalyticsEvents.SIGNUP_COMPLETE, {}, currentUser)
  }

  return (
    <SignupFlowLayout
      title={t('Add your location')}
      subtitle={`${t('Add your location to see more relevant content and find people and projects near you')}.`}
      topInset={insets.top}
      bottomInset={insets.bottom}
      footer={(
        <>
          <SignupFlowButton label={t('< Back')} onPress={() => navigation.goBack()} variant='back' />
          <SignupFlowButton label={t('Finish')} onPress={saveAndFinish} />
        </>
      )}
    >
      <View className='mb-3 flex-row items-center justify-between'>
        <Text className='font-bold text-white'>Selected:</Text>
        {locationObject?.fullText && (
          <Pressable onPress={() => setLocationObject(undefined)}>
            <Entypo name='cross' size={20} color='#ffffffcc' />
          </Pressable>
        )}
      </View>
      <Text className='mb-4 text-base text-white'>
        {locationObject?.fullText || '(None selected)'}
      </Text>
      {!locationObject?.fullText && (
        <View className='flex-1'>
          <LocationSelector onSelect={setLocationObject} />
        </View>
      )}
    </SignupFlowLayout>
  )
}
