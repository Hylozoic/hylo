import React from 'react'
import { get } from 'lodash/fp'
import { View, Text } from 'react-native'
import { useTranslation } from 'react-i18next'
import FastImage from 'react-native-fast-image'
import LinearGradient from 'react-native-linear-gradient'
import useCurrentGroup from '@hylo/hooks/useCurrentGroup'
import useHasResponsibility, { RESP_ADD_MEMBERS } from '@hylo/hooks/useHasResponsibility'
import useOpenURL from 'hooks/useOpenURL'
import Button from 'components/Button'
import MemberList from 'components/MemberList'
import { bannerlinearGradientColors } from '@hylo/presenters/colors'
import styles from './Members.styles'

export default function Members ({ isFocused }) {
  const openURL = useOpenURL()
  const [{ currentGroup: group }] = useCurrentGroup()
  const hasResponsibility = useHasResponsibility({ forCurrentGroup: true, forCurrentUser: true })
  const canInvite = hasResponsibility(RESP_ADD_MEMBERS)
  const showInviteButton = get('allowGroupInvites', group) || canInvite
  const goToInvitePeople = () => openURL(`/groups/${group?.slug}/settings/invite`)
  const showMember = id => openURL(`/groups/${group?.slug}/members/${id}`)

  return (
    <View style={styles.container}>
      <MemberList showMember={showMember} isServerSearch>
        {group && (
          <Banner
            bannerUrl={group.bannerUrl}
            name={group.name}
            group={group}
            handleInviteOnPress={goToInvitePeople}
            showInviteButton={showInviteButton}
          />
        )}
      </MemberList>
    </View>
  )
}

export function Banner ({ name, bannerUrl, showInviteButton, handleInviteOnPress }) {
  const { t } = useTranslation()
  return (
    <View style={styles.bannerContainer}>
      <FastImage source={{ uri: bannerUrl }} style={styles.image} />
      <LinearGradient style={styles.gradient} colors={bannerlinearGradientColors} />
      <View style={styles.titleRow}>
        <Text style={styles.name}>{name}</Text>
      </View>
      {showInviteButton && (
        <Button
          text={t('Invite')}
          style={styles.inviteButton}
          iconName='Invite'
          onPress={handleInviteOnPress}
        />
      )}
    </View>
  )
}
