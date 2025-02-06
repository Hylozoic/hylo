import React from 'react'
import { Text, TouchableOpacity, View, SectionList, Image } from 'react-native'
import { useNavigation } from '@react-navigation/native'
import { useTranslation } from 'react-i18next'
import FastImage from 'react-native-fast-image'
import useCurrentUser from '@hylo/hooks/useCurrentUser'
import useCurrentGroup from '@hylo/hooks/useCurrentGroup'
import useRouteParams from 'hooks/useRouteParams'
import useChangeToGroup from 'hooks/useChangeToGroup'
import { PUBLIC_GROUP, ALL_GROUP, MY_CONTEXT_GROUP } from '@hylo/presenters/GroupPresenter'
// import groupExplorerUrl from 'assets/group-explorer.png'
import earthUrl from 'assets/earth.png'
import myHomeUrl from 'assets/my-home.png'
import Loading from 'components/Loading'

export default function ContextSwitchMenu () {
  const { t } = useTranslation()
  const navigation = useNavigation()
  const { myHome } = useRouteParams()
  const [{ currentUser, fetching: currentUserFetching }] = useCurrentUser()
  const [{ currentGroup, fetching: currentGroupFetching }] = useCurrentGroup()
  const memberships = currentUser?.memberships

  const changeToGroup = useChangeToGroup()

  const navigateToPublicStream = () => {
    navigation.navigate('Group Navigation', { groupSlug: PUBLIC_GROUP.slug })
    navigation.navigate('Stream', { initial: false })
  }

  const navigateToPublicMap = () => {
    navigation.navigate('Map', { groupSlug: PUBLIC_GROUP.slug })
  }

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
    <SectionList
      style={styles.container}
      renderSectionHeader={SectionHeader}
      SectionSeparatorComponent={({ trailingSection, leadingItem }) => (
        !trailingSection && !leadingItem
          ? <View style={styles.groupSectionSeparator} />
          : null
      )}
      sections={listSections}
      stickySectionHeadersEnabled={false}
    />
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

import { StyleSheet } from 'react-native'
import { isIOS } from 'util/platform'
import {
  bigStone, rhino, rhino50, persimmon, rhino40, black10onRhino, white, rhino30
} from 'style/colors'

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#222',
    overflow: 'hidden',
    paddingVertical: 10
  },
  // Groups rows
  sectionHeader: {
    marginTop: 20
  },
  sectionHeaderText: {
    color: rhino50,
    fontFamily: 'Circular-Book',
    fontSize: 12
  },
  groupSectionSeparator: {
    marginHorizontal: 15,
    marginTop: -10,
    marginBottom: 10,
    borderBottomColor: rhino30,
    borderBottomWidth: StyleSheet.hairlineWidth
  },
  rowTouchable: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  groupRow: {
    marginLeft: 10,
    paddingVertical: 10,
    paddingHorizontal: 10
  },
  allStreamsIcon: {
    marginLeft: 5,
    marginRight: 11
  },
  groupAvatar: {
    height: 24,
    width: 24,
    marginRight: 8,
    borderRadius: 4
  },
  groupRowText: {
    fontFamily: 'Circular-Book',
    color: rhino40,
    flex: 1,
    fontSize: 16
  },
  highlight: {
    color: 'white',
    fontFamily: 'Circular-Bold'
  },
  isMember: {
    color: 'white'
  },
  badge: {
    backgroundColor: persimmon,
    height: 20,
    width: 20,
    borderRadius: 100,
    alignItems: 'center',
    justifyContent: 'center'
  },
  badgeText: {
    color: 'white',
    fontSize: 12
  },

  // Footer
  createGroupButton: {
    backgroundColor: black10onRhino,
    paddingTop: 15,
    paddingBottom: 15,
    height: 40,
    fontSize: 14,
    paddingRight: '7%',
    paddingLeft: '7%'
  },
  footer: {
    backgroundColor: bigStone,
    padding: 10,
    paddingBottom: isIOS ? 30 : 10,
    flexDirection: 'row',
    alignItems: 'stretch'
  },
  footerContent: {
    flex: 1,
    marginLeft: 10
  },
  footerTopText: {
    color: 'white',
    fontSize: 16
  },
  footerText: {
    color: 'white',
    fontSize: 14
  },
  footerButtons: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 4
  },
  footerButton: {
    marginRight: 30
  }
})
