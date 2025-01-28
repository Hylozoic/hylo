import React from 'react'
import { get } from 'lodash/fp'
import { View, Text } from 'react-native'
import { useNavigation } from '@react-navigation/native'
import { useTranslation } from 'react-i18next'
import FastImage from 'react-native-fast-image'
import LinearGradient from 'react-native-linear-gradient'
import useCurrentGroup from 'hooks/useCurrentGroup'
import useHasResponsibility, { RESP_ADD_MEMBERS } from 'hooks/useHasResponsibility'
import Button from 'components/Button'
import MemberList from 'components/MemberList'
import { bannerlinearGradientColors } from 'style/colors'
import styles from './Members.styles'

export default function Members ({ isFocused }) {
  const navigation = useNavigation()
  const [{ currentGroup: group }] = useCurrentGroup()
  const hasResponsibility = useHasResponsibility({ forCurrentGroup: true, forCurrentUser: true })
  const canInvite = hasResponsibility(RESP_ADD_MEMBERS)

  const goToInvitePeople = () => navigation.navigate('Group Settings', { screen: 'Invite' })
  const showInviteButton = get('allowGroupInvites', group) || canInvite
  const showMember = id => navigation.navigate('Member', { id })

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
