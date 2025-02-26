import React, { useState } from 'react'
import { useFocusEffect, useNavigation } from '@react-navigation/native'
import { useTranslation } from 'react-i18next'
import { ScrollView, View, Text, ImageBackground, ActivityIndicator } from 'react-native'
import { useMutation } from 'urql'
import { AnalyticsEvents } from '@hylo/shared'
import updateUserSettingsMutation from '@hylo/graphql/mutations/updateUserSettingsMutation'
import mixpanel from 'services/mixpanel'
import KeyboardFriendlyView from 'components/KeyboardFriendlyView'
import ImagePicker from 'components/ImagePicker'
import Button from 'components/Button'
import Icon from 'components/Icon'
import Loading from 'components/Loading'
import styles from './SignupUploadAvatar.styles'
import { useAuth } from '@hylo/contexts/AuthContext'

export default function SignupUploadAvatar () {
  const { t } = useTranslation()
  const navigation = useNavigation()
  const { currentUser, fetching } = useAuth()
  const [, updateUserSettings] = useMutation(updateUserSettingsMutation)
  const [avatarUrl, setAvatarUrl] = useState(currentUser?.avatarUrl)
  const [avatarImageSource, setAvatarImageSource] = useState({ uri: avatarUrl })
  const [imagePickerPending, setImagePickerPending] = useState(false)

  useFocusEffect(() => {
    navigation.setOptions({
      headerLeftOnPress: async () => {
        // onCancel: This will have the effect of fully Authorizing the user
        // and they will be forwarded to `AuthRoot`
        const { error } = await updateUserSettings({ changes: { settings: { signupInProgress: false } } })
        if (error) {
          console.log('!!! Error cancelling signup', error)
        } else {
          mixpanel.track(AnalyticsEvents.SIGNUP_COMPLETE)
        }
      }
    })
  })

  const handleAvatarImageUpload = ({ local, remote }) => {
    setAvatarImageSource({ uri: local })
    setAvatarUrl(remote || local)
  }

  const saveAndNext = async () => {
    const response = await updateUserSettings({ changes: { avatarUrl, settings: { signupInProgress: false } } })
    if (!response?.error) navigation.navigate('SignupSetLocation')
  }

  if (fetching) {
    return <Loading />
  }

  return (
    <KeyboardFriendlyView style={styles.container}>
      <ScrollView keyboardDismissMode='on-drag' keyboardShouldPersistTaps='handled'>
        <View style={styles.header}>
          <Text style={styles.title}>{t('Upload a Photo')}</Text>
        </View>
        <View style={styles.content}>
          <ImagePicker
            type='userAvatar'
            cameraType='front'
            id={currentUser?.id}
            onChoice={handleAvatarImageUpload}
            onPendingChange={pending => setImagePickerPending(pending)}
          >
            {avatarImageSource && (
              <ImageBackground style={styles.imagePickerBackground} imageStyle={styles.image} source={avatarImageSource}>
                {imagePickerPending && (
                  <View style={styles.imageLoading}>
                    <ActivityIndicator size='large' />
                  </View>
                )}
              </ImageBackground>
            )}
            {!avatarImageSource && (
              <View style={styles.imagePickerBackground}>
                {imagePickerPending ? <Loading /> : <Icon name='AddImage' style={styles.cameraIcon} />}
              </View>
            )}
          </ImagePicker>
        </View>
      </ScrollView>
      <View style={styles.bottomBar}>
        <Button
          style={styles.continueButton}
          disabled={imagePickerPending}
          text={t('Continue')}
          onPress={saveAndNext}
        />
      </View>
    </KeyboardFriendlyView>
  )
}
