import React, { useCallback, useEffect, useState } from 'react'
import { ScrollView, View, Text, TouchableOpacity } from 'react-native'
import { useFocusEffect, useNavigation } from '@react-navigation/native'
import { useTranslation } from 'react-i18next'
import { gql, useMutation } from 'urql'
import { CodeField, Cursor, useBlurOnFulfill, useClearByFocusCell } from 'react-native-confirmation-code-field'
import FontAwesome5Icon from 'react-native-vector-icons/FontAwesome5'
import { AnalyticsEvents } from '@hylo/shared'
import { trackWithConsent } from 'services/mixpanel'
import errorMessages from 'util/errorMessages'
import useRouteParams from 'hooks/useRouteParams'
import sendEmailVerificationMutation from '@hylo/graphql/mutations/sendEmailVerificationMutation'
import KeyboardFriendlyView from 'components/KeyboardFriendlyView'
import meAuthFieldsFragment from '@hylo/graphql/fragments/meAuthFieldsFragment'
import FormattedError from 'components/FormattedError'
import controlStyles from 'components/SettingControl/SettingControl.styles'
import styles from './SignupEmailValidation.styles'

const CODE_LENGTH = 6

export const verifyEmailMutation = gql`
  mutation VerifyEmailMutation($email: String!, $code: String, $token: String) {
    verifyEmail(email: $email, code: $code, token: $token) {
      me {
        ...MeAuthFieldsFragment
      }
      error
    }
  }
  ${meAuthFieldsFragment}
`

export default function SignupEmailValidation () {
  const { t } = useTranslation()
  const navigation = useNavigation()
  const { email, token } = useRouteParams()
  const [, verifyEmail] = useMutation(verifyEmailMutation)
  const [, sendEmailVerification] = useMutation(sendEmailVerificationMutation)
  const [loading, setLoading] = useState()
  const [verificationCode, setVerificationCode] = useState()
  const [error, setError] = useState()
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

      const response = await verifyEmail({ email, code: verificationCode, token })
      const { error: responseError = null } = response?.data?.verifyEmail

      if (responseError) {
        if (responseError === 'invalid-link') {
          navigation.replace('Signup Intro', { bannerError: errorMessages(responseError) })
          return
        }
        setError(responseError)
      } else {
        trackWithConsent(AnalyticsEvents.SIGNUP_EMAIL_VERIFIED, { email })
        navigation.navigate('SignupRegistration')
      }
    } catch (e) {
      setError(t('Expired or invalid code'))
    } finally {
      setLoading(false)
    }
  }

  useFocusEffect(
    useCallback(() => {
      if (!email) navigation.replace('Signup')
      if (token) submit()

      navigation.setOptions({
        headerLeftOnPress: () => {
          navigation.replace('Signup Intro', { email })
        }
      })
    }, [token, email])
  )

  useEffect(() => {
    setError()
    if (verificationCode?.length === CODE_LENGTH) submit()
  }, [verificationCode])

  // {loading && (
  //   <Loading />
  // )}

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
          <CodeField
            ref={verificationCodeRef}
            {...props}
            value={verificationCode}
            onChangeText={setVerificationCode}
            cellCount={CODE_LENGTH}
            rootStyle={styles.codeFieldRoot}
            keyboardType='number-pad'
            editable={!loading}
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
          <TouchableOpacity onPress={resendCode} style={styles.resendCodeLink}>
            <Text style={styles.resendCodeLinkText}><FontAwesome5Icon name='redo-alt' /> {t('Resend code')}</Text>
          </TouchableOpacity>
        </View>
        <FormattedError error={error} styles={controlStyles} />
      </ScrollView>
    </KeyboardFriendlyView>
  )
}
