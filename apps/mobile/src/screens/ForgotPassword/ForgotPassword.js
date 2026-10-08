import React, { useState } from 'react'
import { ScrollView, Text, TextInput, View, TouchableOpacity } from 'react-native'
import { gql, useMutation } from 'urql'
import { useNavigation } from '@react-navigation/native'
import { useTranslation } from 'react-i18next'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import EntypoIcon from 'react-native-vector-icons/Entypo'
import validator from 'validator'
import FormattedError from 'components/FormattedError/FormattedError'
import styles from './ForgotPassword.styles'

export default function ForgotPassword ({ error }) {
  // Renders the "Reset Your Password" flow for unauthenticated users.
  const insets = useSafeAreaInsets()
  const { t } = useTranslation()
  const navigation = useNavigation()
  const [, sendPasswordReset] = useMutation(gql`
    mutation SendPasswordReset ($email: String!) {
      sendPasswordReset(email: $email) {
        success
      }
    }
  `)
  const [emailIsValid, setEmailIsValid] = useState(false)
  const [email, providedSetEmail] = useState()
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState()

  const setEmail = emailValue => {
    setEmailIsValid(validator.isEmail(emailValue))
    providedSetEmail(emailValue)
  }

  const handleSubmit = async () => {
    if (!emailIsValid || submitting) return

    try {
      setSubmitting(true)
      setFormError()

      const { data } = await sendPasswordReset({ email })
      const success = data?.sendPasswordReset?.success

      if (!success) {
        setFormError(t('There was a problem with your request. Please check your email and try again.'))
        return
      }

      navigation.navigate('Login', {
        bannerMessage: t('A link to reset your password has been sent to you at {{email}}', { email })
      })
    } catch (err) {
      setFormError(err?.message || err)
    } finally {
      setSubmitting(false)
    }
  }

  const resolvedError = error || formError

  return (
    <View style={{ flex: 1, paddingTop: insets.top, paddingBottom: insets.bottom, paddingRight: insets.right, paddingLeft: insets.left }}>
      <ScrollView contentContainerStyle={styles.forgotPassword} style={styles.container}>
        <View style={styles.paddedRow}>
          <Text style={styles.messageText}>
            {t('forgotPasswordDescription')}
          </Text>
        </View>
        {resolvedError && (
          <FormattedError error={resolvedError} action='Reset Password' />
        )}
        {!resolvedError && (
          <View style={styles.labelRow}>
            <Text style={styles.labelText}>{t('Email address')}</Text>
          </View>
        )}
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
        <View style={styles.paddedRow}>
          <TouchableOpacity onPress={handleSubmit} disabled={!emailIsValid || submitting} style={styles.forgotPasswordButton}>
            <Text style={styles.forgotPasswordText}>{t('Send')}</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  )
}
