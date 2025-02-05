import React, { useState } from 'react'
import { useFocusEffect } from '@react-navigation/native'
import { useTranslation } from 'react-i18next'
import { ScrollView, View, Text, ImageBackground, ActivityIndicator } from 'react-native'
import { useMutation } from 'urql'
import { AnalyticsEvents } from '@hylo/shared'
import useCurrentUser from '@hylo/hooks/useCurrentUser'
import updateUserSettingsMutation from '@hylo/graphql/mutations/updateUserSettingsMutation'
import mixpanel from 'services/mixpanel'
import KeyboardFriendlyView from 'components/KeyboardFriendlyView'
import ImagePicker from 'components/ImagePicker'
import Button from 'components/Button'
import Icon from 'components/Icon'
import Loading from 'components/Loading'
import styles from './SignupUploadAvatar.styles'

export default function SignupUploadAvatar ({ navigation }) {
  const { t } = useTranslation()
  const [{ currentUser, fetching }] = useCurrentUser()
  const [, updateUserSettings] = useMutation(updateUserSettingsMutation)
  const [avatarUrl, setAvatarUrl] = useState(currentUser?.avatarUrl)
  const [avatarImageSource, setAvatarImageSource] = useState({ uri: avatarUrl })
  const [imagePickerPending, setImagePickerPending] = useState(false)

  useFocusEffect(() => {
    navigation.setOptions({
      headerLeftOnPress: () => {
        // onCancel: This will have the effect of fully Authorizing the user
        // and they will be forwarded to `AuthRoot`
        updateUserSettings({ changes: { signupInProgress: false } })
        mixpanel.track(AnalyticsEvents.SIGNUP_COMPLETE)
      }
    })
  })

  const handleAvatarImageUpload = ({ local, remote }) => {
    setAvatarImageSource({ uri: local })
    setAvatarUrl(remote || local)
  }

  const saveAndNext = async () => {
    const { error } = await updateUserSettings({ changes: { avatarUrl } })
    if (!error) navigation.navigate('SignupSetLocation')
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
            id={currentUser.id}
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
