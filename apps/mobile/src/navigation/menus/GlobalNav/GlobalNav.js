import React, { Suspense } from 'react'
import { View, TouchableOpacity, Text } from 'react-native'
import { useTranslation } from 'react-i18next'
import { useNavigation } from '@react-navigation/native'
import { useDispatch } from 'react-redux'
import FastImage from 'react-native-fast-image'
import { StyleSheet } from 'react-native'
import { isIOS } from 'util/platform'
import Icon from 'components/Icon'
import { cn } from '../../../util'
import useCurrentUser from 'hooks/useCurrentUser'
import useCurrentGroup from 'hooks/useCurrentGroup'
import useChangeToGroup from 'hooks/useChangeToGroup'
import setCurrentGroupSlug from 'store/actions/setCurrentGroupSlug'
import { PUBLIC_GROUP } from 'urql-shared/presenters/GroupPresenter'
import {
  bigStone, rhino, rhino50, persimmon, rhino40, black10onRhino, white, rhino30
} from 'style/colors'

export default function GlobalNav() {
  const { t } = useTranslation()
  const navigation = useNavigation()
  const dispatch = useDispatch()
  const [{ currentUser }] = useCurrentUser()
  const [{ currentGroup }] = useCurrentGroup()
  const memberships = currentUser?.memberships
  const changeToGroup = useChangeToGroup()
  const myGroups = memberships && memberships
    .map(m => m.group)
    .sort((a, b) => a.name.localeCompare(b.name))

  const navigateToPublicStream = () => {
    dispatch(setCurrentGroupSlug(PUBLIC_GROUP.slug))
    navigation.navigate('Home Tab', { screen: 'Stream', initial: false })
  }

  const navItems = [
    { ...PUBLIC_GROUP, navigateTo: navigateToPublicStream, name: t('Public Stream') },
  ]
  
  /* 
    Aspirations for GlobalNav
     - On background touch or on gesture scroll, display tool-tip like popups on each groups name display to the right of each group avatar
     - Reconcile navigation needs between the web GlobalNav and the mobile GlobalNav and its sibling, the BottomNavBar
  */
  return (
    <View className="flex-col h-full bg-theme-background z-50 items-center py-2 px-3">
      <View className="flex-1 overflow-y-scroll gap-1">
        {navItems.map(item => (
          <NavRow
            key={item.id}
            item={item}
            changeToGroup={changeToGroup}
            currentGroupSlug={currentGroup?.slug}
          />
        ))}
        {myGroups?.map(group => (
          <GroupRow
            key={group.id}
            group={group}
            changeToGroup={changeToGroup}
            currentGroupSlug={currentGroup?.slug}
            addPadding
          />
        ))}
      </View>
    </View>
  )
}

function GroupRow ({ group, changeToGroup, currentGroupSlug, addPadding, isMember = true, badgeCount = 0, className }) {
  const { id, avatarUrl, name, slug } = group
  const newPostCount = Math.min(99, group.newPostCount)
  const highlight = slug === currentGroupSlug
  // TODO: this is only partially restructured based off the updated web version of this
  return (
    <TouchableOpacity onPress={() => changeToGroup(group?.slug, false)} style={styles.rowTouchable}>
      <View
        className={cn(
          'bg-primary relative transition-all ease-in-out duration-250 flex flex-col items-center justify-center w-14 h-14 min-h-10 rounded-lg drop-shadow-md opacity-60 scale-90',
          {
            'border-3 border-secondary opacity-100 scale-100 hover:scale-110': highlight,
            'border-3 border-accent opacity-100 scale-100': badgeCount > 0

            // Todo: figure out how to make /my/, notifications, messages and commons all be bigger and fully opaque
          },
          className
        )}
      >
          {!!avatarUrl &&
            <FastImage source={{ uri: avatarUrl }} style={styles.groupAvatar} />}
          {/* <Text
            style={[styles.groupRowText, highlight && styles.highlight, isMember && styles.isMember]}
            ellipsizeMode='tail'
            numberOfLines={1}
          >
            {name}
          </Text> */}
          {!!newPostCount && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{newPostCount}</Text>
            </View>
          )}
      </View>
    </TouchableOpacity>

  )
}

function NavRow ({ item, addPadding }) {
  const { avatarUrl, name, navigateTo } = item
  const highlight = 0
  return (
    <TouchableOpacity onPress={() => navigateTo()} style={styles.rowTouchable}>
      <View
        className={cn(
          'bg-primary relative transition-all ease-in-out duration-250 flex flex-col items-center justify-center w-14 h-14 min-h-10 rounded-lg drop-shadow-md opacity-60 scale-90',
          {
            'border-3 border-secondary opacity-100 scale-100 hover:scale-110': highlight,

            // Todo: figure out how to make /my/, notifications, messages and commons all be bigger and fully opaque
          }
        )}
      >
        {!!avatarUrl &&
          <FastImage source={{ uri: avatarUrl }} style={styles.groupAvatar} />}
        {/* <Text
          style={styles.groupRowText}
          ellipsizeMode='tail'
          numberOfLines={1}
        >
          {name}
        </Text> */}
      </View>
    </TouchableOpacity>
  )
}

const styles = {
  container: {
    flex: 1,
    backgroundColor: rhino
  },

  // Header
  headerBackgroundImage: {},
  headerBannerGradient: {
    position: 'absolute',
    width: '100%',
    height: '100%'
  },
  headerContent: {
    flexDirection: 'column',
    alignItems: 'center',
    padding: 15,
    paddingTop: 40,
    paddingBottom: 20
  },
  headerAvatar: {
    height: 42,
    width: 42,
    borderRadius: 4,
    marginBottom: 6
  },
  headerText: {
    fontFamily: 'Circular-Bold',
    marginBottom: 10,
    color: white,
    fontSize: 20,
    textShadowColor: 'rgba(0, 0, 0, 0.25)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 7
  },
  currentGroupButtons: {
    flexDirection: 'row'
  },
  currentGroupButton: {
    flex: 0.4,
    paddingHorizontal: 5,
    backgroundColor: 'none'
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
    height: 30,
    width: 30,
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
  },

}
