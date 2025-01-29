import React from 'react'
import { Text, TouchableOpacity, View, SectionList, Image } from 'react-native'
import { useNavigation } from '@react-navigation/native'
import { useTranslation } from 'react-i18next'
import FastImage from 'react-native-fast-image'
import LinearGradient from 'react-native-linear-gradient'
import useCurrentUser from 'hooks/useCurrentUser'
import useCurrentGroup from 'hooks/useCurrentGroup'
import useRouteParams from 'hooks/useRouteParams'
import useChangeToGroup from 'hooks/useChangeToGroup'
import useHasResponsibility, { RESP_ADD_MEMBERS, RESP_ADMINISTRATION } from 'hooks/useHasResponsibility'
import { PUBLIC_GROUP, ALL_GROUP, MY_CONTEXT_GROUP } from 'urql-shared/presenters/GroupPresenter'
import styles from './DrawerMenu.styles'
import Button from 'components/Button'
import { bannerlinearGradientColors } from 'style/colors'
// import groupExplorerUrl from 'assets/group-explorer.png'
import earthUrl from 'assets/earth.png'
import myHomeUrl from 'assets/my-home.png'
import Loading from 'components/Loading'

export default function DrawerMenu () {
  const { t } = useTranslation()
  const navigation = useNavigation()
  const [{ currentUser, fetching: currentUserFetching }] = useCurrentUser()
  const [{ currentGroup, fetching: currentGroupFetching }] = useCurrentGroup()
  const memberships = currentUser?.memberships
  const { myHome } = useRouteParams()
  const hasResponsibility = useHasResponsibility({ forCurrentGroup: true, forCurrentUser: true })
  const canAdmin = hasResponsibility(RESP_ADMINISTRATION)
  const canInvite = hasResponsibility(RESP_ADD_MEMBERS)

  const goToCreateGroup = () => {
    navigation.navigate('Create Group', { screen: 'CreateGroupName', params: { reset: true } })
  }
  const goToGroupSettings = () => canAdmin &&
    navigation.navigate('Group Settings')
  const goToInvitePeople = () => canInvite &&
      navigation.navigate('Group Settings', { screen: 'Invite' })
  const changeToGroup = useChangeToGroup()

  const navigateToPublicStream = () => {
    navigation.navigate('Group Navigation', { groupSlug: PUBLIC_GROUP.slug })
    navigation.navigate('Stream', { initial: false })
  }

  const navigateToPublicMap = () => {
    navigation.navigate('Map', { groupSlug: PUBLIC_GROUP.slug })
  }

  // Comment-in once proper group explorer webview is available
  // const navigateToPublicGroups = () => {
  //   navigation.navigate('Group Explore') // this is not the groupexplorer webview...
  // }

  const navigateToMyHome = () => {
    navigation.navigate('Group Navigation', { myHome: true, groupSlug: MY_CONTEXT_GROUP.slug })
    navigation.navigate('My Posts', { initial: false })
  }

  if (!currentUser) {
    return <Loading />
  }

  const myGroups = memberships
    .map(m => m.group)
    .sort((a, b) => a.name.localeCompare(b.name))

  const publicMap = {
    name: t('Public Map'),
    navigateTo: navigateToPublicMap,
    id: 'publicMap',
    avatarUrl: Image.resolveAssetSource(earthUrl).uri
  }

  // Comment-in once proper group explorer webview is available
  // const publicGroups = {
  //   name: 'Explore Groups',
  //   navigateTo: navigateToPublicGroups,
  //   id: 'publicGroups',
  //   avatarUrl: Image.resolveAssetSource(groupExplorerUrl).uri
  // }

  const publicRoutes = [
    { ...PUBLIC_GROUP, navigateTo: navigateToPublicStream, name: t('Public Stream') },
    // publicGroups,
    publicMap
  ]

  const renderItem = ({ item }) => (
    <GroupRow
      group={item}
      changeToGroup={changeToGroup}
      currentGroupSlug={currentGroup?.slug}
      addPadding
    />
  )

  const renderNavItem = ({ item }) => (
    <NavRow
      item={item}
      currentGroupSlug={currentGroup?.slug}
      addPadding
    />
  )
  const keyExtractor = item => 'c' + item.id
  const listSections = [
    {
      data: [{
        name: t('My Home'),
        navigateTo: navigateToMyHome,
        id: 'myHome',
        avatarUrl: Image.resolveAssetSource(myHomeUrl).uri
      }],
      renderItem: renderNavItem,
      keyExtractor
    },
    {
      data: publicRoutes,
      renderItem: renderNavItem,
      keyExtractor
    },
    {
      data: [ALL_GROUP, ...myGroups],
      renderItem,
      keyExtractor
    }
  ]
  const groupBannerImage = currentGroup?.bannerUrl
    ? { uri: currentGroup?.bannerUrl }
    : null

  if (currentUserFetching || currentGroupFetching) return null

  return (
    <View style={styles.container}>
      {currentGroup && !myHome && (
        <FastImage source={groupBannerImage} style={styles.headerBackgroundImage}>
          <LinearGradient style={styles.headerBannerGradient} colors={bannerlinearGradientColors} />
          <View style={[styles.headerContent]}>
            <FastImage source={{ uri: currentGroup.avatarUrl }} style={styles.headerAvatar} />
            <Text style={styles.headerText}>{currentGroup.name}</Text>
            {(canAdmin || canInvite) && (
              <View style={styles.currentGroupButtons}>
                {canAdmin && (
                  <Button
                    style={styles.currentGroupButton}
                    iconName='Settings'
                    onPress={goToGroupSettings}
                    text={t('Settings')}
                  />
                )}
                {canInvite && (
                  <Button
                    style={styles.currentGroupButton}
                    iconName='Invite'
                    onPress={goToInvitePeople}
                    text={t('Invite')}
                  />
                )}
              </View>
            )}
          </View>
        </FastImage>
      )}
      <SectionList
        renderSectionHeader={SectionHeader}
        SectionSeparatorComponent={({ trailingSection, leadingItem }) => (
          !trailingSection && !leadingItem
            ? <View style={styles.groupSectionSeparator} />
            : null
        )}
        sections={listSections}
        stickySectionHeadersEnabled={false}
      />
      <Button text={t('Start a Group')} onPress={goToCreateGroup} style={styles.createGroupButton} />
    </View>
  )
}

export function TextButton ({ text, onPress }) {
  return (
    <TouchableOpacity onPress={onPress} style={styles.footerButton} hitSlop={{ top: 20, bottom: 10, left: 10, right: 15 }}>
      <Text style={{ color: 'white', fontSize: 14 }}>{text}</Text>
    </TouchableOpacity>
  )
}

export function SectionHeader ({ section }) {
  return (
    <View style={styles.sectionHeader}>
      {section.label && (
        <Text style={styles.sectionHeaderText}>{section.label.toUpperCase()}</Text>
      )}
    </View>
  )
}

export function GroupRow ({ group, changeToGroup, currentGroupSlug, addPadding, isMember = true }) {
  const { id, avatarUrl, name } = group
  const newPostCount = Math.min(99, group.newPostCount)
  const highlight = id === currentGroupSlug
  return (
    <View style={[styles.groupRow, addPadding && styles.defaultPadding]}>
      <TouchableOpacity onPress={() => changeToGroup(group?.slug, false)} style={styles.rowTouchable}>
        {!!avatarUrl &&
          <FastImage source={{ uri: avatarUrl }} style={styles.groupAvatar} />}
        <Text
          style={[styles.groupRowText, highlight && styles.highlight, isMember && styles.isMember]}
          ellipsizeMode='tail'
          numberOfLines={1}
        >
          {name}
        </Text>
        {!!newPostCount && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{newPostCount}</Text>
          </View>
        )}
      </TouchableOpacity>
    </View>
  )
}

export function NavRow ({ item, addPadding }) {
  const { avatarUrl, name, navigateTo } = item
  return (
    <View style={[styles.groupRow, addPadding && styles.defaultPadding]}>
      <TouchableOpacity onPress={() => navigateTo()} style={styles.rowTouchable}>
        {!!avatarUrl &&
          <FastImage source={{ uri: avatarUrl }} style={styles.groupAvatar} />}
        <Text
          style={styles.groupRowText}
          ellipsizeMode='tail'
          numberOfLines={1}
        >
          {name}
        </Text>
      </TouchableOpacity>
    </View>
  )
}
