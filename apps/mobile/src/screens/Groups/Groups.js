import { useEffect, useState } from 'react'
import { useNavigation } from '@react-navigation/native'
import { gql, useQuery } from 'urql'
import { View, Text, SectionList, TouchableOpacity } from 'react-native'
import FastImage from 'react-native-fast-image'
import { modalScreenName } from 'hooks/useIsModalScreen'
import useCurrentUser from '@hylo/hooks/useCurrentUser'
import useCurrentGroup from '@hylo/hooks/useCurrentGroup'
import { useChangeToGroup } from 'hooks/useHandleCurrentGroup'
import { visibilityIcon, accessibilityIcon } from '@hylo/presenters/GroupPresenter'
import Icon from 'components/Icon'
import Loading from 'components/Loading'
import styles from './Groups.styles'
import { useTranslation } from 'react-i18next'

// Note: Groups data now comes from useCurrentGroup() hook
// which uses the shared GraphQL fragments from @hylo/graphql

export default function Groups () {
  const { t } = useTranslation()
  const navigation = useNavigation()
  const [{ currentUser }] = useCurrentUser()
  const [{ currentGroup, fetching: currentGroupFetching }] = useCurrentGroup()
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(currentGroupFetching)
  }, [currentGroupFetching])

  const goToGroupExplore = groupSlug =>
    navigation.navigate(modalScreenName('Group Explore'), { groupSlug })

  if (loading) return <Loading />

  // Debug: Log currentGroup to see what data we have
  if (currentGroup && __DEV__) {
    console.log('🔍 Groups Screen - currentGroup:', JSON.stringify({
      id: currentGroup.id,
      name: currentGroup.name,
      hasChildGroups: !!currentGroup.childGroups,
      hasParentGroups: !!currentGroup.parentGroups,
      hasPeerGroups: !!currentGroup.peerGroups,
      childGroupsCount: currentGroup.childGroups?.items?.length || 0,
      parentGroupsCount: currentGroup.parentGroups?.items?.length || 0,
      peerGroupsCount: currentGroup.peerGroups?.items?.length || 0
    }, null, 2))
  }

  const memberships = currentUser?.memberships
  const joinRequests = currentUser?.joinRequests?.items || []
  const childGroups = currentGroup?.childGroups?.items?.map(g => {
    g.memberStatus = memberships.find(m => m.group.id === g.id)
      ? 'member'
      : joinRequests.find(jr => jr.group.id === g.id)
        ? 'requested'
        : 'not'
    return g
  }) || []
  const parentGroups = currentGroup?.parentGroups?.items?.map(g => {
    g.memberStatus = memberships.find(m => m.group.id === g.id)
      ? 'member'
      : joinRequests.find(jr => jr.group.id === g.id)
        ? 'requested'
        : 'not'
    return g
  }) || []
  const peerGroups = currentGroup?.peerGroups?.items?.map(g => {
    g.memberStatus = memberships.find(m => m.group.id === g.id)
      ? 'member'
      : joinRequests.find(jr => jr.group.id === g.id)
        ? 'requested'
        : 'not'
    return g
  }) || []

  const listSections = []
  const renderItem = ({ item }) => (
    <GroupRow
      group={item}
      memberships={memberships}
      goToGroupExplore={goToGroupExplore}
      addPadding
    />
  )
  const keyExtractor = item => 'g' + item.id

  if (parentGroups.length > 0) {
    listSections.push({
      title: t('{{currentGroupName}} is a part of {{parentGroupsLength}} Group(s)', { currentGroupName: currentGroup.name, parentGroupsLength: parentGroups.length }),
      data: parentGroups,
      renderItem,
      keyExtractor
    })
  }

  if (childGroups.length > 0) {
    listSections.push({
      title: t('{{childGroupsLength}} Group(s) are a part of {{currentGroupName}}', { childGroupsLength: childGroups.length, currentGroupName: currentGroup.name }),
      data: childGroups,
      renderItem,
      keyExtractor
    })
  }

  if (peerGroups.length > 0) {
    listSections.push({
      title: t('{{currentGroupName}} is connected to {{peerGroupsLength}} peer Group(s)', { currentGroupName: currentGroup.name, peerGroupsLength: peerGroups.length }),
      data: peerGroups,
      renderItem,
      keyExtractor
    })
  }

  const renderSectionHeader = ({ section: { title } }) => (
    <Text style={styles.sectionHeader}>{title}</Text>
  )

  return (
    <SectionList
      style={styles.container}
      sections={listSections}
      stickySectionHeadersEnabled={false}
      renderSectionHeader={renderSectionHeader}
    />
  )
}

export function GroupRow ({ group, memberships, goToGroupExplore }) {
  const { t } = useTranslation()
  const { avatarUrl, description, name, memberCount, childGroups } = group
  const childGroupsCount = childGroups?.count()
  const changeToGroup = useChangeToGroup()
  const handleOnPress = () => changeToGroup(group?.slug, { confirm: true })
  const statusText = group.memberStatus === 'member'
    ? t('Member')
    : group.memberStatus === 'requested'
      ? t('Membership Requested')
      : t('Not a Member')

  return (
    <TouchableOpacity onPress={handleOnPress} style={styles.groupRow}>
      {!!avatarUrl && (
        <FastImage source={{ uri: avatarUrl }} style={styles.groupAvatar} />
      )}
      <View style={styles.groupRowRight}>
        <Text style={styles.groupRowText} ellipsizeMode='tail' numberOfLines={1}>
          {name}
        </Text>
        <View style={styles.groupStatus}>
          <Icon style={styles.groupStatusIcon} name={visibilityIcon(group.visibility)} />
          <Icon style={styles.groupStatusIcon} name={accessibilityIcon(group.accessibility)} />
          <Text style={styles.groupStatusText}>{statusText}</Text>
        </View>
        <Text style={[styles.groupRowCounts]}>
          {memberCount} {t('Member', { count: memberCount })} {childGroupsCount > 0 ? ` | ${childGroupsCount} ${t('Group', { childGroupsCount })}` : ''}
        </Text>
        {!!description && (
          <Text style={[styles.groupRowDescription]} ellipsizeMode='tail' numberOfLines={1}>{description}</Text>
        )}
      </View>
    </TouchableOpacity>
  )
}
