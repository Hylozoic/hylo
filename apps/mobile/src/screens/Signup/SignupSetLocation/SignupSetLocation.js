import React, { useRef, useState } from 'react'
import { ScrollView, View, Text } from 'react-native'
import { useFocusEffect } from '@react-navigation/native'
import { useMutation } from 'urql'
import { useTranslation } from 'react-i18next'
import { AnalyticsEvents } from '@hylo/shared'
import mixpanel from 'services/mixpanel'
import useCurrentUser from '@hylo/hooks/useCurrentUser'
import { useAuth } from '@hylo/contexts/AuthContext'
import updateUserSettingsMutation from '@hylo/graphql/mutations/updateUserSettingsMutation'
import KeyboardFriendlyView from 'components/KeyboardFriendlyView'
import LocationSelectorModal from 'components/LocationSelectorModal'
import Button from 'components/Button'
import SettingControl from 'components/SettingControl'
import styles from './SignupSetLocation.styles'

export default function SignupSetLocation ({ navigation }) {
  const { t } = useTranslation()
  const locationSelectorModalRef = useRef()
  const [{ currentUser }] = useCurrentUser()
  const [location, setLocation] = useState(currentUser?.location)
  const [locationId, setLocationId] = useState(currentUser?.locationId)
  const [, updateUserSettings] = useMutation(updateUserSettingsMutation)
  const { checkAuth } = useAuth()
  const controlRef = useRef()

  useFocusEffect(() => {
    navigation.setOptions({
      headerLeftOnPress: () => {
        // onCancel: This will have the effect of fully Authorizing the user
        // and they will be forwarded to `AuthRoot`
        updateUserSettings({ changes: { settings: { signupInProgress: false } } })
        mixpanel.track(AnalyticsEvents.SIGNUP_COMPLETE)
      }
    })
  })

  const finish = async () => {
    controlRef.current && controlRef.current.blur()
    await updateUserSettings({
      changes: {
        location,
        locationId,
        settings: { signupInProgress: false }
      }
    })
    mixpanel.track(AnalyticsEvents.SIGNUP_COMPLETE)
    // This may not be necessary
    await checkAuth()
  }

  const showLocationPicker = () => locationSelectorModalRef.current.show()

  const handleUpdateLocation = pickedLocation => {
    setLocation(pickedLocation?.fullText)
    pickedLocation?.id !== 'NEW' && setLocationId(pickedLocation?.id)
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
          <LocationSelectorModal
            ref={locationSelectorModalRef}
            onItemPress={handleUpdateLocation}
          />
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
