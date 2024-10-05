import React, { useEffect, useRef, useState } from 'react'
import { ScrollView, View, Text } from 'react-native'
import { useFocusEffect } from '@react-navigation/native'
import { useDispatch, useSelector } from 'react-redux'
import { useTranslation } from 'react-i18next'
import { AnalyticsEvents } from 'hylo-shared'
import useCurrentLocation from 'hooks/useCurrentLocation'
import getMe from 'store/selectors/getMe'
import checkLogin from 'store/actions/checkLogin'
import trackAnalyticsEvent from 'store/actions/trackAnalyticsEvent'
import updateUserSettings from 'store/actions/updateUserSettings'
import KeyboardFriendlyView from 'components/KeyboardFriendlyView'
import Button from 'components/Button'
import SettingControl from 'components/SettingControl'
import LocationPicker from 'screens/LocationPicker/LocationPicker'
import styles from './SignupSetLocation.styles'

export default function SignupSetLocation ({ navigation }) {
  const { t } = useTranslation()
  const dispatch = useDispatch()
  const currentUser = useSelector(getMe)
  const [location, setLocation] = useState(currentUser?.location)
  const [locationId, setLocationId] = useState(currentUser?.locationId)
  const [currentLocation, getLocation] = useCurrentLocation()
  const controlRef = useRef()

  useEffect(() => { getLocation() }, [])

  useFocusEffect(() => {
    navigation.setOptions({
      headerLeftOnPress: () => {
        // onCancel: This will have the effect of fully Authorizing the user
        // and they will be forwarded to `AuthRoot`
        dispatch(updateUserSettings({ settings: { signupInProgress: false } }))
        dispatch(trackAnalyticsEvent(AnalyticsEvents.SIGNUP_COMPLETE))
      }
    })
  })

  const finish = async () => {
    controlRef.current && controlRef.current.blur()
    await dispatch(updateUserSettings({ location, locationId, settings: { signupInProgress: false } }))
    await dispatch(trackAnalyticsEvent(AnalyticsEvents.SIGNUP_COMPLETE))
    await dispatch(checkLogin())
  }

  const showLocationPicker = locationText => {
    LocationPicker({
      navigation,
      currentLocation,
      initialSearchTerm: locationText,
      onPick: pickedLocation => {
        setLocation(pickedLocation?.fullText)
        pickedLocation?.id !== 'NEW' && setLocationId(pickedLocation?.id)
      },
      t
    })
  }

  return (
    <KeyboardFriendlyView style={styles.container}>
      <ScrollView keyboardDismissMode='on-drag' keyboardShouldPersistTaps='handled'>
        <View style={styles.header}>
          <Text style={styles.title}>{t('Add your location')}</Text>
          <Text style={styles.subTitle}>
            {t('Add your location to see more relevant content and find people and projects near you')}.
          </Text>
        </View>
        <View style={styles.content}>
          <SettingControl
            ref={controlRef}
            label={t('Where do you call home')}
            value={location}
            onFocus={() => showLocationPicker(location)}
          />
        </View>
      </ScrollView>
      <View style={styles.bottomBar}>
        <Button
          style={styles.backButton}
          text={t('< Back')}
          onPress={() => navigation.goBack()}
        />
        <Button
          style={styles.continueButton}
          text={t('Finish')}
          onPress={finish}
        />
      </View>
    </KeyboardFriendlyView>
  )
}
