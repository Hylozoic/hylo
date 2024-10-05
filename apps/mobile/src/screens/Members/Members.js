import React from 'react'
import { View, Text } from 'react-native'
import FastImage from 'react-native-fast-image'
import LinearGradient from 'react-native-linear-gradient'
import { get, pick } from 'lodash/fp'
import Button from 'components/Button'
import MemberList from 'components/MemberList'
import { bannerlinearGradientColors } from 'style/colors'
import styles from './Members.styles'
import { useTranslation } from 'react-i18next'

export default function Members ({
  group,
  canInvite,
  navigation,
  ...forwardedProps
}) {
  const goToInvitePeople = () => navigation.navigate('Group Settings', { screen: 'Invite' })
  const showInviteButton = get('allowGroupInvites', group) || canInvite

  return (
    <View style={styles.container}>
      <MemberList
        group={group}
        isServerSearch
        {...pick([
          'isFocused',
          'hasMore',
          'members',
          'pending',
          'slug',
          'search',
          'sortKeys',
          'sortBy',
          'setSort',
          'setSearch',
          'fetchMembers',
          'showMember',
          'fetchMoreMembers'], forwardedProps)}
      >
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
