import React, { useState } from 'react'
import { ScrollView, Text, TextInput, View, TouchableOpacity } from 'react-native'
import { useDispatch } from 'react-redux'
import { useNavigation } from '@react-navigation/native'
import validator from 'validator'
import EntypoIcon from 'react-native-vector-icons/Entypo'
import sendPasswordReset from 'store/actions/sendPasswordReset'
import styles from './ForgotPassword.styles'
import { useTranslation } from 'react-i18next'

export default function ForgotPassword ({ error }) {
  const { t } = useTranslation()
  const navigation = useNavigation()
  const dispatch = useDispatch()
  const [emailIsValid, setEmailIsValid] = useState(false)
  const [email, providedSetEmail] = useState()

  const setEmail = emailValue => {
    setEmailIsValid(validator.isEmail(emailValue))
    providedSetEmail(emailValue)
  }

  const handleSubmit = async () => {
    await dispatch(sendPasswordReset(email))

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
        <FormError />
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

export function FormError () {
  const { t } = useTranslation()
  const rowStyle = styles.emailErrorRow
  const triangleStyle = styles.emailTriangle
  const message = t('Password is invalid or unknown error')
  return (
    <View style={styles.errorView}>
      <View style={rowStyle}>
        <Text style={styles.errorMessage}>{message}</Text>
      </View>
      <View style={triangleStyle} />
    </View>
  )
}
