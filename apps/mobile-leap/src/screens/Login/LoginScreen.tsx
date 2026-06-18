import { useCallback, useRef, useState } from 'react'
import { Image } from 'expo-image'
import { ScrollView, Text, TextInput, Pressable, View } from 'react-native'
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
    <View className='flex-1 bg-background' style={{ paddingBottom: insets.bottom }}>
      <ScrollView className='flex-1 px-6' contentContainerClassName='pb-8 pt-4'>
        {bannerError && (
          <Text className='mb-2 text-center text-destructive' style={{ paddingTop: insets.top }}>
            {bannerError}
          </Text>
        )}
        {!bannerError && bannerMessage && (
          <Text className='mb-2 text-center text-foreground' style={{ paddingTop: insets.top }}>
            {bannerMessage}
          </Text>
        )}

        <Image
          source={require('../../../assets/icon.png')}
          style={{ width: 80, height: 80, alignSelf: 'center', marginVertical: 24 }}
          contentFit='contain'
        />
        <Text className='mb-6 text-center text-2xl font-semibold text-foreground'>
          {t('Log in to Hylo')}
        </Text>

        <Text className='mb-1 text-sm text-muted-foreground'>{t('Email address')}</Text>
        <View className={`mb-4 flex-row items-center rounded-lg border px-3 ${emailIsValid ? 'border-selected' : 'border-border'}`}>
          <TextInput
            className='flex-1 py-3 text-foreground'
            onChangeText={setEmail}
            returnKeyType='next'
            autoCapitalize='none'
            autoCorrect={false}
            keyboardType='email-address'
            onSubmitEditing={() => passwordInputRef.current?.focus()}
          />
          {emailIsValid && <Entypo name='check' size={20} color='#5cb85c' />}
        </View>

        <View className='mb-1 flex-row items-center justify-between'>
          <Text className='text-sm text-muted-foreground'>{t('Password')}</Text>
          <Pressable onPress={() => navigation.navigate('ForgotPassword' as never)}>
            <Text className='text-sm text-secondary'>{t('Forgot your password?')}</Text>
          </Pressable>
        </View>
        <View className='mb-4 flex-row items-center rounded-lg border border-border px-3'>
          <TextInput
            ref={passwordInputRef}
            className='flex-1 py-3 text-foreground'
            secureTextEntry={securePassword}
            autoCapitalize='none'
            onChangeText={setPasswordState}
            returnKeyType='go'
            onSubmitEditing={handleLogin}
          />
          <Pressable onPress={() => setSecurePassword(!securePassword)}>
            <Entypo name={securePassword ? 'eye' : 'eye-with-line'} size={20} color='#888' />
          </Pressable>
        </View>

        <FormattedError error={formError} action='Login' />

        <Pressable
          className={`mb-4 items-center rounded-full py-3 ${emailIsValid ? 'bg-selected' : 'bg-muted opacity-60'}`}
          onPress={handleLogin}
          disabled={!emailIsValid}
        >
          <Text className='font-semibold text-foreground'>{t('Log In')}</Text>
        </Pressable>

        <SocialAuth
          onStart={() => setBannerMessage(t('LOGGING IN'))}
          onComplete={async (error) => {
            if (error) setBannerError(error)
            setBannerMessage(undefined)
          }}
        />

        <View className='mt-6 flex-row justify-center'>
          <Text className='text-muted-foreground'>{t('Dont have an account?')} </Text>
          <Pressable onPress={() => navigation.navigate('Signup' as never)}>
            <Text className='font-semibold text-secondary'>{t('Sign up now')}</Text>
          </Pressable>
        </View>
      </ScrollView>
    </View>
  )
}
