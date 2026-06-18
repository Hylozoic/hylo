import { useState } from 'react'
import { ScrollView, Text, TextInput, Pressable, View } from 'react-native'
import { gql, useMutation } from 'urql'
import { useNavigation } from '@react-navigation/native'
import { useTranslation } from 'react-i18next'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Entypo } from '@expo/vector-icons'
import validator from 'validator'
import FormattedError from '../../components/FormattedError'

const sendPasswordResetMutation = gql`
  mutation SendPasswordReset ($email: String!) {
    sendPasswordReset(email: $email) {
      success
    }
  }
`

export default function ForgotPasswordScreen () {
  const insets = useSafeAreaInsets()
  const { t } = useTranslation()
  const navigation = useNavigation()
  const [, sendPasswordReset] = useMutation(sendPasswordResetMutation)
  const [emailIsValid, setEmailIsValid] = useState(false)
  const [email, setEmailState] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState<string>()

  const setEmail = (value: string) => {
    setEmailIsValid(validator.isEmail(value))
    setEmailState(value)
  }

  const handleSubmit = async () => {
    if (!emailIsValid || submitting) return

    try {
      setSubmitting(true)
      setFormError(undefined)
      const { data } = await sendPasswordReset({ email })
      if (!data?.sendPasswordReset?.success) {
        setFormError(t('There was a problem with your request. Please check your email and try again.'))
        return
      }
      navigation.navigate('Login' as never, {
        bannerMessage: t('A link to reset your password has been sent to you at {{email}}', { email })
      } as never)
    } catch (err) {
      setFormError((err as Error).message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <View className='flex-1 bg-background' style={{ paddingTop: insets.top, paddingBottom: insets.bottom }}>
      <ScrollView className='flex-1 px-6'>
        <Text className='mb-6 mt-4 text-base text-foreground'>
          {t('forgotPasswordDescription')}
        </Text>
        <FormattedError error={formError} action='Reset Password' />
        {!formError && (
          <Text className='mb-1 text-sm text-muted-foreground'>{t('Email address')}</Text>
        )}
        <View className={`mb-6 flex-row items-center rounded-lg border px-3 ${emailIsValid ? 'border-selected' : 'border-border'}`}>
          <TextInput
            className='flex-1 py-3 text-foreground'
            onChangeText={setEmail}
            autoCapitalize='none'
            keyboardType='email-address'
          />
          {emailIsValid && <Entypo name='check' size={20} color='#5cb85c' />}
        </View>
        <Pressable
          className={`items-center rounded-full py-3 ${emailIsValid ? 'bg-selected' : 'bg-muted opacity-60'}`}
          onPress={handleSubmit}
          disabled={!emailIsValid || submitting}
        >
          <Text className='font-semibold text-foreground'>{t('Send')}</Text>
        </Pressable>
      </ScrollView>
    </View>
  )
}
