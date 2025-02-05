import React, { useCallback } from 'react'
import {
  View,
  TouchableOpacity,
  Alert
} from 'react-native'
import { useTranslation } from 'react-i18next'
import Icon from 'components/Icon'
import PopupMenuButton from 'components/PopupMenuButton'
import { filter, get, isEmpty } from 'lodash/fp'
import { AnalyticsEvents } from '@hylo/shared'
import { AXOLOTL_ID } from '@hylo/presenters/PersonPresenter'
import useCurrentUser from '@hylo/hooks/useCurrentUser'
import mixpanel from 'services/mixpanel'
import Control from 'screens/MemberProfile/Control'
import { openURL } from 'hooks/useOpenURL'
import { useNavigation } from '@react-navigation/native'
import { useMutation } from 'urql'
import blockUserMutation from '@hylo/graphql/mutations/blockUserMutation'
import styles from './MemberHeader.styles'

export default function MemberHeader ({
  person,
  flagMember,
  isMe,
  editable,
  updateSetting = () => {},
  saveChanges,
  errors = {},
  ...props
}) {
  const { t } = useTranslation()
  const navigation = useNavigation()
  const [{ currentUser }] = useCurrentUser()
  const [, blockUser] = useMutation(blockUserMutation)

  if (!person) return null

  const { name, tagline } = person
  const locationText = get('location', person) || get('locationObject.fullText', person)
  const isAxolotl = AXOLOTL_ID === get('id', person)
  // TODO: ItemSelectorModal
  const showLocationPicker = () => {
    // LocationPicker({
    //   navigation,
    //   initialSearchTerm: locationText,
    //   onPick: location => {
    //     updateSetting('location', location?.fullText)
    //     updateSetting('locationId', location?.id)
    //   },
    //   t
    // })
  }

  const handleBlockUserWithConfirmation = () => {
    const blockUserFun = async () => {
      await blockUser(person.id)
      mixpanel.track(AnalyticsEvents.BLOCK_USER)
      navigation.goBack()
    }

    return function () {
      return Alert.alert(
        t('Are you sure you want to block {{name}}?', { name }),
        t('You will no longer see {{name}}s activity and they wont see yours', { name }),
        '',
        t('You can unblock this member at any time Go to Settings > Blocked Users'),
        [
          { text: `${t('Block')} ${name}`, onPress: (blockedUserId) => blockUserFun(blockedUserId) },
          { text: t('Cancel'), style: 'cancel' }
        ])
    }
  }

  const goToEdit = () => openURL('/settings')
  const goToEditAccount = () => openURL('/settings/account')
  const goToManageNotifications = () => openURL('/settings/notifications')
  const goToBlockedUsers = () => openURL('/settings/blocked-users')

  const handleMessages = useCallback(() => {
    if (!person || currentUser.id === person.id) {
      navigation.navigate('Messages Tab')
    }

    const { messageThreadId } = person

    if (messageThreadId) {
      navigation.navigate('Messages Tab', { screen: 'Thread', initial: false, params: { id: messageThreadId } })
    }

    navigation.navigate('Messages Tab', { screen: 'New Message', initial: false, params: { participants: person.id } })
  }, [currentUser, person, navigation])

  return (
    <View style={styles.header}>
      <View style={styles.nameRow}>
        <Control
          style={styles.name}
          value={name}
          placeholder={t('Name')}
          editable={editable}
          onChangeText={value => updateSetting('name', value)}
          error={errors.name}
          isMe={isMe}
        />
        <View style={styles.icons}>
          {!isMe && (
            <TouchableOpacity onPress={handleMessages}>
              <Icon name='Messages' style={styles.icon} />
            </TouchableOpacity>
          )}
          <MemberMenu
            {...{
              flagMember,
              isMe,
              saveChanges,
              editable,
              blockUser: handleBlockUserWithConfirmation,
              isAxolotl,
              goToEdit,
              goToEditAccount,
              goToManageNotifications,
              goToBlockedUsers
            }}
          />
        </View>
      </View>
      <Control
        style={styles.location}
        value={locationText}
        placeholder={t('Location')}
        multiline
        editable={editable}
        onPress={showLocationPicker}
        isMe={isMe}
      />
      <Control
        style={styles.tagline}
        value={tagline}
        placeholder={t('Short Description')}
        editable={editable}
        onChangeText={value => updateSetting('tagline', value)}
        isMe={isMe}
      />
    </View>
  )
}

export function blockUserWithConfirmationFun (blockUserFun, name) {
  const { t } = useTranslation()
  return function () {
    return Alert.alert(
      t('Are you sure you want to block {{name}}?', { name }),
      t('You will no longer see {{name}}s activity and they wont see yours', { name }),
      '',
      t('You can unblock this member at any time Go to Settings > Blocked Users'),
      [
        { text: `${t('Block')} ${name}`, onPress: (blockedUserId) => blockUserFun(blockedUserId) },
        { text: t('Cancel'), style: 'cancel' }
      ])
  }
}

export function MemberMenu ({
  flagMember, isMe, blockUser, saveChanges, editable,
  isAxolotl, goToEdit, goToEditAccount,
  goToManageNotifications, goToBlockedUsers
}) {
  const { t } = useTranslation()
  // If the function is defined, than it's a valid action
  const actions = filter(x => x[1], [
    [t('Edit Profile'), isMe && !editable && goToEdit],
    [t('Edit Account'), isMe && !editable && goToEditAccount],
    [t('Manage Notifications'), isMe && !editable && goToManageNotifications],
    [t('Blocked Users'), isMe && !editable && goToBlockedUsers],
    [t('Save Changes'), isMe && editable && saveChanges],
    [t('Flag This Member'), !isMe && flagMember],
    [t('Block This Member'), !isMe && !isAxolotl && blockUser]
  ])

  if (isEmpty(actions)) return null

  const destructiveButtonIndex = get('1.0', actions) === t('Block This Member') ? 1 : -1

  return (
    <PopupMenuButton
      actions={actions}
      destructiveButtonIndex={destructiveButtonIndex}
    >
      <Icon name='More' style={styles.lastIcon} />
    </PopupMenuButton>
  )
}
