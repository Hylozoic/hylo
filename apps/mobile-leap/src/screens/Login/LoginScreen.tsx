import { useCallback, useEffect, useRef, useState } from 'react'
import { Image } from 'expo-image'
import { Dimensions, Pressable, ScrollView, Text, TextInput, View } from 'react-native'
import { useTranslation } from 'react-i18next'
import { useFocusEffect, useNavigation } from '@react-navigation/native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Entypo } from '@expo/vector-icons'
import { useAuth } from '@hylo/contexts/AuthContext'
import useRouteParams from '../../hooks/useRouteParams'
import validator from 'validator'
import errorMessages from 'util/errorMessages'
import SocialAuth from '../../components/SocialAuth'
import FormattedError from '../../components/FormattedError'
import { AuthBanner, AuthInput, AuthPrimaryButton } from '../../components/auth/AuthScreenParts'
import KeyboardFriendlyView from '../../components/KeyboardFriendlyView'
import LocaleSelector from '../../components/LocaleSelector'

const screenHeight = Dimensions.get('window').height
const logoTopMargin = Math.max(0, (screenHeight - 580) * 0.4)

export default function LoginScreen () {
  const insets = useSafeAreaInsets()
  const { t } = useTranslation()
  const navigation = useNavigation()
  const passwordInputRef = useRef<TextInput>(null)
  const { login } = useAuth()
  const [email, setEmailState] = useState('')
  const [password, setPasswordState] = useState('')
  const [securePassword, setSecurePassword] = useState(true)
  const [emailIsValid, setEmailIsValid] = useState(false)
  const [bannerError, setBannerError] = useState<string>()
  const [bannerMessage, setBannerMessage] = useState<string>()
  const [formError, setFormErrorState] = useState<string>()
  const { bannerMessage: bannerMessageParam, bannerError: bannerErrorParam } = useRouteParams<{
    bannerMessage?: string
    bannerError?: string
  }>()

  const setFormError = (error: unknown) => {
    const type = (error as Error)?.message || String(error)
    setFormErrorState(errorMessages(type))
  }

  const clearErrors = useCallback(() => {
    setFormErrorState(undefined)
    setBannerError(undefined)
    setBannerMessage(undefined)
  }, [])

  useFocusEffect(
    useCallback(() => {
      clearErrors()
      if (bannerErrorParam) setBannerError(errorMessages(bannerErrorParam))
      if (bannerMessageParam) setBannerMessage(bannerMessageParam)
    }, [bannerErrorParam, bannerMessageParam, clearErrors])
  )

  const setEmail = (value: string) => {
    clearErrors()
    setEmailIsValid(validator.isEmail(value))
    setEmailState(value)
  }

  const handleLogin = async () => {
    try {
      setBannerMessage(t('LOGGING IN'))
      await login({ email, password })
    } catch (err) {
      setBannerMessage(undefined)
      setFormError(err)
    }
  }

  return (
    <KeyboardFriendlyView testID='login-screen' className='flex-1 bg-white' style={{ paddingBottom: insets.bottom }}>
      {bannerError && <AuthBanner message={bannerError} variant='error' topInset={insets.top} />}
      {!bannerError && bannerMessage && <AuthBanner message={bannerMessage} topInset={insets.top} />}

      <ScrollView
        className='flex-1'
        keyboardShouldPersistTaps='handled'
        contentContainerStyle={{
          flexGrow: 1,
          justifyContent: 'center',
          alignItems: 'center',
          paddingBottom: 32
        }}
      >
        <View className='w-full items-start px-4' style={{ marginTop: insets.top + 8 }}>
          <LocaleSelector />
        </View>
        <Image
          source={require('../../../assets/merkaba-green-on-white.png')}
          style={{ width: 80, height: 80, marginTop: logoTopMargin, marginBottom: 10 }}
          contentFit='contain'
        />
        <Text className='mb-5 text-2xl font-bold text-selected'>{t('Log in to Hylo')}</Text>

        <View className='w-full'>
          <AuthInput
            label={t('Email address')}
            value={email}
            onChangeText={setEmail}
            valid={emailIsValid}
            keyboardType='email-address'
            returnKeyType='next'
            onSubmitEditing={() => passwordInputRef.current?.focus()}
            testID='login-email-input'
          />

          <View className='mb-1 flex-row items-center justify-between px-4'>
            <Text className='text-sm text-foreground/80'>{t('Password')}</Text>
            <Pressable onPress={() => navigation.navigate('ForgotPassword' as never)}>
              <Text className='text-sm text-selected'>{t('Forgot your password?')}</Text>
            </Pressable>
          </View>
          <AuthInput
            label=''
            value={password}
            onChangeText={setPasswordState}
            secureTextEntry={securePassword}
            returnKeyType='go'
            onSubmitEditing={handleLogin}
            inputRef={passwordInputRef}
            testID='login-password-input'
            rightAccessory={(
              <Pressable onPress={() => setSecurePassword(!securePassword)}>
                <Entypo name={securePassword ? 'eye' : 'eye-with-line'} size={20} color='#888' />
              </Pressable>
            )}
          />
        </View>

        <View className='w-full px-4'>
          <FormattedError error={formError} action='Login' />
          <AuthPrimaryButton label={t('Log In')} onPress={handleLogin} disabled={!emailIsValid} testID='login-submit-button' />
        </View>

        <SocialAuth
          onStart={() => setBannerMessage(t('LOGGING IN'))}
          onComplete={async (error) => {
            if (error) setBannerError(error)
            setBannerMessage(undefined)
          }}
        />

        <View className='mt-6 flex-row'>
          <Text className='text-foreground/70'>{t('Dont have an account?')} </Text>
          <Pressable onPress={() => navigation.navigate('Signup' as never)}>
            <Text className='font-bold text-selected'>{t('Sign up now')}</Text>
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardFriendlyView>
  )
}
