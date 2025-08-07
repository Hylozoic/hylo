import React, { useState } from 'react'
import { ScrollView, Text, TextInput, View, TouchableOpacity } from 'react-native'
import { gql, useMutation } from 'urql'
import { useNavigation } from '@react-navigation/native'
import { useTranslation } from 'react-i18next'
import EntypoIcon from 'react-native-vector-icons/Entypo'
import validator from 'validator'
import FormattedError from '../../components/FormattedError/FormattedError'
import styles from './ForgotPassword.styles'

export default function ForgotPassword ({ error }) {
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

  const setEmail = emailValue => {
    setEmailIsValid(validator.isEmail(emailValue))
    providedSetEmail(emailValue)
  }

  const handleSubmit = async () => {
    await sendPasswordReset(email)

    navigation.navigate('Login', {
      bannerMessage: t('A link to reset your password has been sent to you at {{email}}', { email })
    })
  }

  return (
    <ScrollView contentContainerStyle={styles.forgotPassword} style={styles.container}>
      <View style={styles.paddedRow}>
        <Text style={styles.messageText}>
          {t('forgotPasswordDescription')}
        </Text>
      </View>
      {error && (
        <FormattedError error={error} />
      )}
      {!error && (
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
        <TouchableOpacity onPress={handleSubmit} disabled={!emailIsValid} style={styles.forgotPasswordButton}>
          <Text style={styles.forgotPasswordText}>{t('Send')}</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  )
}