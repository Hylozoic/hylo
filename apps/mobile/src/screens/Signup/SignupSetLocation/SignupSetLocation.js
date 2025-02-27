import React, { useState } from 'react'
import { View, Text, TouchableOpacity } from 'react-native'
import { useFocusEffect } from '@react-navigation/native'
import { useMutation } from 'urql'
import { useTranslation } from 'react-i18next'
import { AnalyticsEvents } from '@hylo/shared'
import mixpanel from 'services/mixpanel'
import updateUserSettingsMutation from '@hylo/graphql/mutations/updateUserSettingsMutation'
import KeyboardFriendlyView from 'components/KeyboardFriendlyView'
import { LocationSelector } from 'components/LocationSelectorModal/LocationSelectorModal'
import Button from 'components/Button'
import styles from '../SignupFlow.styles'
import { nevada, rhino80, white, white80onCaribbeanGreen } from 'style/colors'

export default function SignupSetLocation ({ navigation }) {
  const { t } = useTranslation()
  const [locationObject, setLocationObject] = useState()
  const [, updateUserSettings] = useMutation(updateUserSettingsMutation)

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

  const finish = () => {
    updateUserSettings({
      changes: {
        location: locationObject.fullText,
        locationId: locationObject.id,
        settings: { signupInProgress: false }
      }
    })
    mixpanel.track(AnalyticsEvents.SIGNUP_COMPLETE)
  }

  return (
    <KeyboardFriendlyView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>{t('Add your location')}</Text>
        <Text style={styles.subTitle}>
          {t('Add your location to see more relevant content and find people and projects near you')}.
        </Text>
      </View>
      <View style={styles.content}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <Text style={{ fontSize: 16, fontWeight: 'bold', color: white }}>Selected:</Text>
          <TouchableOpacity onPress={() => setLocationObject()}>
            <Text style={{ color: nevada, fontWeight: 'bold' }}>{locationObject?.fullText && 'Clear'}</Text>
          </TouchableOpacity>
        </View>
        <Text style={{ fontSize: 16, marginBottom: 20, color: white }}>{locationObject?.fullText || '(none selected)'}</Text>
        <View style={{ flex: 1, padding: 10, backgroundColor: white80onCaribbeanGreen, borderRadius: 20 }}>
          <LocationSelector colors={{ text: rhino80, border: rhino80 }} onItemPress={setLocationObject} />
        </View>
      </View>
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
