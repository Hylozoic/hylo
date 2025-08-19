import React, { useState } from 'react'
import { View, Text } from 'react-native'
import { useFocusEffect } from '@react-navigation/native'
import { useMutation } from 'urql'
import { useTranslation } from 'react-i18next'
import { AnalyticsEvents } from '@hylo/shared'
import updateUserSettingsMutation from '@hylo/graphql/mutations/updateUserSettingsMutation'
import { X } from 'lucide-react-native'
import { trackWithConsent } from 'services/mixpanel'
import KeyboardFriendlyView from 'components/KeyboardFriendlyView'
import { LocationSelector } from 'components/LocationSelectorModal/LocationSelectorModal'
import Button from 'components/Button'
import styles from '../SignupFlow.styles'
import Colors from '../../../style/theme-colors'

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
        trackWithConsent(AnalyticsEvents.SIGNUP_COMPLETE)
      }
    })
  })

  const saveAndNext = () => {
    updateUserSettings({
      changes: {
        location: locationObject?.fullText,
        locationId: locationObject?.id,
        settings: { signupInProgress: false }
      }
    })
    trackWithConsent(AnalyticsEvents.SIGNUP_COMPLETE)
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
          <Text style={{ fontWeight: 'bold', fontSize: 16, color: Colors.muted }}>Selected:</Text>
          {locationObject?.fullText && (
            <X size={20} style={{ color: Colors.selected80 }} onPress={() => setLocationObject()} />
          )}
        </View>
        <Text style={{ fontSize: 16, marginBottom: 18, color: Colors.muted }}>
          {locationObject?.fullText || '(None selected)'}
        </Text>
        {!locationObject?.fullText && (
                      <LocationSelector
              style={{ flex: 0, padding: 10, backgroundColor: Colors.selected80, borderRadius: 20 }}
            colors={{ text: Colors.selected, border: Colors.selected }}
            onItemPress={setLocationObject}
          />
        )}
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
          onPress={saveAndNext}
        />
      </View>
    </KeyboardFriendlyView>
  )
}
