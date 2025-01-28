import React, { useCallback, useEffect, useState } from 'react'
import { ScrollView, View, Text, TouchableOpacity } from 'react-native'
import { useFocusEffect } from '@react-navigation/native'
import { CodeField, Cursor, useBlurOnFulfill, useClearByFocusCell } from 'react-native-confirmation-code-field'
import FontAwesome5Icon from 'react-native-vector-icons/FontAwesome5'
import errorMessages from 'util/errorMessages'
import { AnalyticsEvents } from '@hylo/shared'
import { sendEmailVerificationMutation } from '../Signup'
import KeyboardFriendlyView from 'components/KeyboardFriendlyView'
import Loading from 'components/Loading'
import FormattedError from 'components/FormattedError'
import controlStyles from 'components/SettingControl/SettingControl.styles'
import styles from './SignupEmailValidation.styles'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useTranslation } from 'react-i18next'
import { gql, useMutation } from 'urql'

const CODE_LENGTH = 6

// TODO: URQL - Analytics
// analytics: {
//   eventName: AnalyticsEvents.SIGNUP_EMAIL_VERIFIED,
//   email
// }
export const verifyEmailMutation = gql`
  mutation VerifyEmailMutation($email: String!, $code: String, $token: String) {
    verifyEmail(email: $email, code: $code, token: $token) {
      me {
        id
        avatarUrl
        email
        emailValidated
        hasRegistered
        name
        settings {
          alreadySeenTour
          dmNotifications
          commentNotifications
          signupInProgress
          streamViewMode
          streamSortBy
          streamPostType
        }
      }
      error
    }
  }
`

export default function SignupEmailValidation ({ navigation, route }) {
  const { t } = useTranslation()
  const [, verifyEmail] = useMutation(verifyEmailMutation)
  const [, sendEmailVerification] = useMutation(sendEmailVerificationMutation)
  const [loading, setLoading] = useState()
  const [verificationCode, setVerificationCode] = useState()
  const [error, setError] = useState()

  const email = route.params?.email
  const token = route.params?.token

  const verificationCodeRef = useBlurOnFulfill({
    value: verificationCode,
    cellCount: CODE_LENGTH
  })
  const [props, getCellOnLayoutHandler] = useClearByFocusCell({
    value: verificationCode,
    setValue: setVerificationCode
  })

  const resendCode = async () => {
    try {
      setLoading(true)

      await sendEmailVerification({ email })
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const submit = async () => {
    try {
      setLoading(true)

      const response = await verifyEmail({ email, verificationCode, token })
      const { error: responseError = null } = response.payload.getData()

      if (responseError) {
        if (responseError === 'invalid-link') {
          navigation.navigate('Signup Intro', { bannerError: errorMessages(responseError) })
          return
        }
        setError(responseError)
      }
    } catch (e) {
      setError(t('Expired or invalid code'))
    } finally {
      setLoading(false)
    }
  }

  useFocusEffect(
    useCallback(() => {
      if (!email) navigation.navigate('Signup')

      navigation.setOptions({
        headerLeftOnPress: () => {
          navigation.navigate('Signup Intro', { email })
        }
      })
    }, [email])
  )

  useEffect(() => {
    if (token) submit()
  }, [token])

  useEffect(() => {
    setError()
    if (verificationCode?.length === CODE_LENGTH) submit()
  }, [verificationCode])

  return (
    <KeyboardFriendlyView style={styles.container}>
      <ScrollView keyboardDismissMode='on-drag' keyboardShouldPersistTaps='handled'>
        <View style={styles.header}>
          <Text style={styles.title}>
            {t('Check your email')}
          </Text>
          <View>
            <Text style={styles.subTitle}>{t('Weve sent a 6 digit code to')}:</Text>
            <Text style={[styles.subTitle, { marginVertical: 10, fontWeight: 'bold' }]}>{email}</Text>
            <Text style={styles.subTitle}>{t('The code will expire shortly, so please enter it here soon')}.</Text>
          </View>
        </View>
        <View style={styles.content}>
          {loading && (
            <Loading />
          )}
          {!loading && (
            <CodeField
              ref={verificationCodeRef}
              {...props}
              value={verificationCode}
              onChangeText={setVerificationCode}
              cellCount={CODE_LENGTH}
              rootStyle={styles.codeFieldRoot}
              keyboardType='number-pad'
              textContentType='oneTimeCode'
              renderCell={({ index, symbol, isFocused }) => (
                <Text
                  key={index}
                  style={[styles.codeFieldCell, isFocused && styles.codeFieldCellFocused]}
                  onLayout={getCellOnLayoutHandler(index)}
                >
                  {symbol || (isFocused ? <Cursor /> : <Text> </Text>)}
                </Text>
              )}
            />
          )}
          <TouchableOpacity onPress={resendCode} style={styles.resendCodeLink}>
            <Text style={styles.resendCodeLinkText}><FontAwesome5Icon name='redo-alt' /> {t('Resend code')}</Text>
          </TouchableOpacity>
        </View>
        <FormattedError error={error} styles={controlStyles} />
      </ScrollView>
    </KeyboardFriendlyView>
  )
}
