import React, { useState } from 'react'
import { useFocusEffect } from '@react-navigation/native'
import { ScrollView, View, Text, ImageBackground, ActivityIndicator } from 'react-native'
import { useDispatch, useSelector } from 'react-redux'
import { AnalyticsEvents } from '@hylo/shared'
import getMe from 'store/selectors/getMe'
import trackAnalyticsEvent from 'store/actions/trackAnalyticsEvent'
import updateUserSettings from 'store/actions/updateUserSettings'
import KeyboardFriendlyView from 'components/KeyboardFriendlyView'
import ImagePicker from 'components/ImagePicker'
import Button from 'components/Button'
import Icon from 'components/Icon'
import Loading from 'components/Loading'
import styles from './SignupUploadAvatar.styles'
import { useTranslation } from 'react-i18next'

export default function SignupUploadAvatar ({ navigation }) {
  const { t } = useTranslation()
  const dispatch = useDispatch()
  const currentUser = useSelector(getMe)
  const [avatarUrl, setAvatarUrl] = useState(currentUser?.avatarUrl)
  const [avatarImageSource, setAvatarImageSource] = useState({ uri: avatarUrl })
  const [imagePickerPending, setImagePickerPending] = useState(false)

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

  const handleAvatarImageUpload = ({ local, remote }) => {
    setAvatarImageSource({ uri: local })
    setAvatarUrl(remote || local)
  }

  const saveAndNext = async () => {
    const response = await dispatch(updateUserSettings({ avatarUrl }))
    const responseError = response.payload.getData()?.error

    if (!responseError) navigation.navigate('SignupSetLocation')
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
