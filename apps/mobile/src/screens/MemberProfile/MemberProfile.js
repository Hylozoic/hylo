import React, { useEffect, useState } from 'react'
import { Text, View, TouchableOpacity } from 'react-native'
import { useTranslation, withTranslation } from 'react-i18next'
import { useMutation, useQuery } from 'urql'
import { useNavigation } from '@react-navigation/native'
import FastImage from 'react-native-fast-image'
import { get } from 'lodash/fp'
import useRouteParams from 'hooks/useRouteParams'
import useCurrentUser from 'frontend-shared/hooks/useCurrentUser'
import useCurrentGroup from 'frontend-shared/hooks/useCurrentGroup'
import useIsModalScreen from 'hooks/useIsModalScreen'
import updateUserSettingsMutation from 'frontend-shared/graphql/mutations/updateUserSettingsMutation'
import personQuery from 'frontend-shared/graphql/queries/personQuery'
import Loading from 'components/Loading'
import MemberStream from './MemberStream'
import MemberHeader from './MemberHeader'
import ImagePicker from 'components/ImagePicker'
import FlagContent from 'components/FlagContent'
import EntypoIcon from 'react-native-vector-icons/Entypo'
import defaultBanner from 'assets/default-user-banner.jpg'
import ModalHeaderTransparent from 'navigation/headers/ModalHeaderTransparent'
import styles from './MemberProfile.styles'

function MemberProfile ({ isFocused }) {
  const { id } = useRouteParams()
  const navigation = useNavigation()
  const isModalScreen = useIsModalScreen()
  const [{ currentGroup }] = useCurrentGroup()
  const [{ currentUser }] = useCurrentUser()

  const [{ data, fetching, error }] = useQuery({ query: personQuery, variables: { id }, pause: !id })
  const person = id ? data?.person : currentUser
  const isMe = Number(get('id', currentUser)) === Number(get('id', person))
  const canFlag = currentUser && id && currentUser.id !== id
  const isBlocked = currentUser?.blockedUsers && currentUser.blockedUsers.filter(blockedPerson => blockedPerson.id === id)

  const goToDetails = () => navigation.navigate('Member Details', { id })

  const [flaggingVisible, setFlaggingVisible] = useState(false)

  const setHeader = () => {
    isModalScreen
      ? navigation.setOptions(ModalHeaderTransparent({ navigation }))
      : navigation.setOptions({ title: currentGroup.name })
  }

  useEffect(() => {
    if (!fetching) {
      if (isBlocked) navigation.goBack()
      setHeader()
    }
  }, [id])

  useEffect(() => {
    setHeader()
  }, [currentGroup?.name])

  if (!person || fetching) return <Loading />

  // Used to generate a link to this post from the backend.
  const linkData = {
    id,
    type: 'member'
  }
  const header = (
    <View>
      <MemberBanner isMe={isMe} person={person} />
      <View style={styles.marginContainer}>
        <MemberHeader
          person={person}
          currentUser={currentUser}
          flagMember={canFlag && (() => setFlaggingVisible(true))}
          isMe={isMe}
        />
        <ReadMoreButton goToDetails={goToDetails} />
      </View>
      {flaggingVisible && (
        <FlagContent
          type='member'
          linkData={linkData}
          onClose={() => setFlaggingVisible(false)}
        />
      )}
    </View>
  )

  return <MemberStream id={id} header={header} navigation={navigation} />
}
export function MemberBanner (props) {
  const { t } = useTranslation()
  const { person: { id, avatarUrl, bannerUrl }, isMe } = props
  const [, updateUserSettings] = useMutation(updateUserSettingsMutation)

  const [avatarPickerPending, setAvatarPickerPending] = useState(false)
  const [bannerPickerPending, setBannerPickerPending] = useState(false)
  const [avatarLocalUri, setAvatarLocalUri] = useState(null)
  const [bannerLocalUri, setBannerLocalUri] = useState(null)

  const handleBannerImageUpload = ({ local, remote }) => {
    if (remote) {
      setBannerLocalUri(local)
      updateUserSettings({ changes: { bannerUrl: remote } })
    }
  }

  const handleAvatarImageUpload = ({ local, remote }) => {
    if (remote) {
      setAvatarLocalUri(local)
      updateUserSettings({ changes: { avatarUrl: remote } })
    }
  }

  const avatarSource = avatarLocalUri
    ? { uri: avatarLocalUri }
    : avatarUrl && { uri: avatarUrl }

  // This is a surprisingly annoying piece of logic. Basically, prefer
  // displaying `bannerLocalUri`, then `bannerUrl`, then `defaultBanner`.
  // However, don't display `defaultBanner` only to be replaced with
  // `bannerUrl` after the request finishes! The trick to it is this:
  // `bannerUrl` will be undefined until the request finishes, then it should
  // be either string or null. So we don't display the default unless it's null.
  let bannerSource = { uri: bannerLocalUri || bannerUrl }
  if (bannerUrl === null && bannerLocalUri === null) {
    bannerSource = defaultBanner
  }

  return (
    <View>
      <ImagePicker
        title={t('Change Banner')}
        type='userBanner'
        style={styles.bannerImagePicker}
        id={id}
        onChoice={choice => handleBannerImageUpload(choice)}
        onPendingChange={pending => setBannerPickerPending(pending)}
        disabled={!isMe}
      >
        <FastImage source={bannerSource} style={styles.bannerImage} />
        {isMe && (
          <EditButton isLoading={bannerPickerPending} style={styles.bannerEditButton} />
        )}
      </ImagePicker>
      <View style={styles.avatarW3}>
        <ImagePicker
          style={styles.avatarWrapperWrapper}
          title={t('Change Avatar')}
          type='userAvatar'
          id={id}
          onChoice={choice => handleAvatarImageUpload(choice)}
          onPendingChange={pending => setAvatarPickerPending(pending)}
          disabled={!isMe}
        >
          <View style={styles.avatarWrapper}>
            <FastImage source={avatarSource} style={styles.avatarImage} />
            {isMe && <EditButton isLoading={avatarPickerPending} style={styles.avatarEditButton} />}
          </View>
        </ImagePicker>
      </View>
    </View>
  )
}

export function EditButton ({ isLoading, style }) {
  const { t } = useTranslation()

  return (
    <View style={[styles.editButton, style]}>
      {isLoading
        ? (
          <Text style={styles.editButtonText}>{t('loading')}</Text>
          )
        : (
          <View style={{ flexDirection: 'row' }}>
            <EntypoIcon name='edit' style={styles.editIcon} />
            <Text style={styles.editButtonText}>{t('edit')}</Text>
          </View>
          )}
    </View>
  )
}

export function ReadMoreButton ({ goToDetails }) {
  const { t } = useTranslation()

  return (
    <View style={styles.buttonContainer}>
      <TouchableOpacity onPress={goToDetails} style={styles.buttonWrapper}>
        <View style={styles.button}>
          <Text style={styles.buttonText}>{t('Read More')}</Text>
        </View>
      </TouchableOpacity>
    </View>
  )
}

export default withTranslation()(MemberProfile)
