import React, { useRef, useState } from 'react'
import { ScrollView, View, Text } from 'react-native'
import { useFocusEffect } from '@react-navigation/native'
import { gql, useMutation } from 'urql'
import { pickBy, identity } from 'lodash/fp'
import { Validators } from '@hylo/shared'
import useLogout from 'hooks/useLogout'
import useForm from 'hooks/useForm'
import confirmDiscardChanges from 'util/confirmDiscardChanges'
import SettingControl from 'components/SettingControl'
import Button from 'components/Button'
import KeyboardFriendlyView from 'components/KeyboardFriendlyView'
import Loading from 'components/Loading'
import styles from './SignupRegistration.styles'
import { useTranslation } from 'react-i18next'

// TODO: URQL - Analytics
// analytics: {
//   eventName: AnalyticsEvents.SIGNUP_REGISTERED
// }
export const registerMutation = gql`
  mutation RegisterMutation ($name: String!, $password: String!) {
    register(name: $name, password: $password) {
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
    }
  }
`

export default function SignupRegistration ({ navigation, route }) {
  const { t } = useTranslation()
  const [, register] = useMutation(registerMutation)
  const logout = useLogout()
  const passwordControlRef = useRef()
  const confirmPasswordControlRef = useRef()
  const [loading, setLoading] = useState()
  // WIP: Need to display response error somewhere on page
  const [error, setError] = useState()

  const saveAndNext = async () => {
    try {
      setLoading(true)
      const response = await register({ name: values.name, password: values.password })
      const { error: responseError = null } = response.payload.getData()

      if (responseError) {
        setError(responseError)
      }
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  const validator = ({ name, password, confirmPassword }) => {
    return pickBy(identity, {
      name: Validators.validateUser.name(name),
      password: Validators.validateUser.password(password),
      confirmPassword: (password?.length > 8) && (password !== confirmPassword) && t('Passwords must match')
    })
  }

  const { values, errors, handleChange, handleSubmit } = useForm(saveAndNext, validator)

  useFocusEffect(() => {
    navigation.setOptions({
      headerLeftOnPress: () => {
        confirmDiscardChanges({
          title: '',
          confirmationMessage: t('Were almost done, are you sure you want to cancel signing-up?'),
          disgardButtonText: t('Yes'),
          continueButtonText: t('No'),
          onDiscard: () => {
            logout()
            navigation.navigate('Signup Intro')
          },
          t
        })
      }
    })
  })

  return (
    <KeyboardFriendlyView style={styles.container}>
      <ScrollView keyboardDismissMode='on-drag' keyboardShouldPersistTaps='handled'>
        <View style={styles.header}>
          <Text style={styles.title}>{t('Lets do this!')}</Text>
          <Text style={styles.subTitle}>
            Hi <Text style={{ fontWeight: 'bold' }}>{values.email}</Text> {t('we just need to know your name and password and youre account will be created')}.
          </Text>
        </View>
        <View style={styles.content}>
          {loading && <Loading />}
          {!loading && (
            <>
              <SettingControl
                label={t('Your Full Name')}
                value={values.name}
                onChange={value => handleChange('name', value)}
                error={errors.name}
                returnKeyType='next'
                onSubmitEditing={() => passwordControlRef.current.focus()}
              />
              <SettingControl
                ref={passwordControlRef}
                label={t('Password (at least 9 characters)')}
                value={values.password}
                onChange={value => handleChange('password', value)}
                toggleSecureTextEntry
                error={errors.password}
                returnKeyType='next'
                onSubmitEditing={() => confirmPasswordControlRef.current.focus()}
              />
              <SettingControl
                ref={confirmPasswordControlRef}
                label={t('Confirm Password')}
                value={values.confirmPassword}
                onChange={value => handleChange('confirmPassword', value)}
                toggleSecureTextEntry
                error={errors.confirmPassword}
                returnKeyType='go'
                onSubmitEditing={handleSubmit}
              />
            </>
          )}
        </View>
      </ScrollView>
      <View style={styles.bottomBar}>
        <Button
          style={styles.continueButton}
          text={loading ? t('Saving-ellipsis') : t('Continue')}
          onPress={handleSubmit}
          disabled={!!loading}
        />
      </View>
    </KeyboardFriendlyView>
  )
}
