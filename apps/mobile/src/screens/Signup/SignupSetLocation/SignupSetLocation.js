import React, { useRef, useState } from 'react'
import { ScrollView, View, Text, TouchableOpacity } from 'react-native'
import { useFocusEffect } from '@react-navigation/native'
import { useMutation } from 'urql'
import { useTranslation } from 'react-i18next'
import { AnalyticsEvents } from '@hylo/shared'
import mixpanel from 'services/mixpanel'
import useCurrentUser from '@hylo/hooks/useCurrentUser'
import { useAuth } from '@hylo/contexts/AuthContext'
import updateUserSettingsMutation from '@hylo/graphql/mutations/updateUserSettingsMutation'
import KeyboardFriendlyView from 'components/KeyboardFriendlyView'
import { LocationSelector } from 'components/LocationSelectorModal/LocationSelectorModal'
import Button from 'components/Button'
import styles from '../SignupFlow.styles'
import { amaranth, azureRadiance, black10OnCaribbeanGreen, black10onRhino, gunsmoke, linkWater, nevada, pictonBlue, rhino, rhino50, white } from 'style/colors'

export default function SignupSetLocation ({ navigation }) {
  const { t } = useTranslation()
  const [{ currentUser }] = useCurrentUser()
  console.log('!!! currentUser', currentUser)
  const [location, setLocation] = useState(currentUser?.location)
  const [, updateUserSettings] = useMutation(updateUserSettingsMutation)
  const { checkAuth } = useAuth()

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

  const handleUpdateLocation = pickedLocation => {
    setLocation(pickedLocation?.fullText)
    // pickedLocation?.id !== 'NEW' && setLocationId(pickedLocation?.id)
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
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <Text style={{ fontSize: 16, fontWeight: 'bold', color: white }}>Selected:</Text>
            <TouchableOpacity onPress={() => setLocation()}>
              <Text style={{ color: nevada, fontWeight: 'bold' }}>{location && 'Clear'}</Text>
            </TouchableOpacity>
          </View>
          <Text style={{ fontSize: 16, marginBottom: 20, color: white }}>{location || '(none selected)'}</Text>
          <LocationSelector colors={{ text: rhino50, border: gunsmoke }} onItemPress={handleUpdateLocation} />
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
