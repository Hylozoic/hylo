import { useState } from 'react'
import { ScrollView, Text, View } from 'react-native'
import { gql, useMutation } from 'urql'
import { useNavigation } from '@react-navigation/native'
import { useTranslation } from 'react-i18next'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import validator from 'validator'
import FormattedError from '../../components/FormattedError'
import { AuthInput, AuthPrimaryButton } from '../../components/auth/AuthScreenParts'
import KeyboardFriendlyView from '../../components/KeyboardFriendlyView'

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
    <KeyboardFriendlyView className='flex-1 bg-white' style={{ paddingTop: insets.top, paddingBottom: insets.bottom }}>
      <ScrollView className='flex-1' keyboardShouldPersistTaps='handled' contentContainerClassName='pb-8'>
        <Text className='mb-6 px-4 pt-4 text-base text-foreground/80'>
          {t('forgotPasswordDescription')}
        </Text>
        <View className='px-4'>
          <FormattedError error={formError} action='Reset Password' />
        </View>
        {!formError && (
          <AuthInput
            label={t('Email address')}
            value={email}
            onChangeText={setEmail}
            valid={emailIsValid}
            keyboardType='email-address'
          />
        )}
        <AuthPrimaryButton
          label={t('Send')}
          onPress={handleSubmit}
          disabled={!emailIsValid || submitting}
          loading={submitting}
        />
      </ScrollView>
    </KeyboardFriendlyView>
  )
}
