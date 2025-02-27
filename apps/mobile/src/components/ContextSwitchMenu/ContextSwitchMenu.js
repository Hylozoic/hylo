import React from 'react'
import { Animated, TouchableOpacity, Text, StyleSheet, View, FlatList } from 'react-native'
import FastImage from 'react-native-fast-image'
import Intercom from '@intercom/intercom-react-native'
import { Globe, Plus, CircleHelp } from 'lucide-react-native'
import { map, sortBy } from 'lodash/fp'
import { clsx } from 'clsx'
import useCurrentUser from '@hylo/hooks/useCurrentUser'
import useCurrentGroup, { useContextGroups } from '@hylo/hooks/useCurrentGroup'
import { openURL } from 'hooks/useOpenURL'
import { widgetUrl as makeWidgetUrl } from 'util/navigation'
import useChangeToGroup from 'hooks/useChangeToGroup'

export default function ContextSwitchMenu () {
  const changeToGroup = useChangeToGroup()
  const [{ currentUser }] = useCurrentUser()
  const [{ currentGroup }] = useCurrentGroup()
  const { myContext, publicContext } = useContextGroups()
  const myGroups = [myContext, publicContext].concat(
    sortBy('name', map(m => m.group, currentUser.memberships))
  )
  // TODO: Set a home path for My and Public
  const homePath = currentGroup && makeWidgetUrl({
    widget: currentGroup?.homeWidget,
    groupSlug: currentGroup?.slug
  })

  const handleOnPress = context => {
    changeToGroup(context?.slug, false)
    if (homePath) openURL(homePath)
  }

  return (
    <Animated.View className='flex-col h-full bg-theme-background z-50 items-center py-2 px-3'>
      <FlatList
        data={myGroups}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <ContextRow
            onPress={handleOnPress}
            item={item}
            currentGroupSlug={currentGroup?.slug}
          />
        )}
        showsVerticalScrollIndicator={false}
      />
      <View className='w-full mt-auto bg-theme-background pt-4'>
        {/* TODO redesign: A Group or Post Creation option is expected based on Web-parity */}
        <TouchableOpacity
          onPress={() => openURL('/create')}
          style={styles.rowTouchable}
          activeOpacity={0.7}
        >
          <View
            className={`
                bg-primary relative flex flex-col text-primary-foreground items-center justify-center
                w-14 h-14 min-h-10 rounded-lg drop-shadow-md opacity-60 scale-90
            `}
          >
            <Plus />
          </View>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => Intercom.present()}
          style={styles.rowTouchable}
          activeOpacity={0.7}
        >
          <View className='bg-primary relative flex flex-col text-primary-foreground items-center justify-center w-14 h-14 min-h-10 rounded-lg drop-shadow-md opacity-60 scale-90'>
            <CircleHelp />
          </View>
        </TouchableOpacity>
      </View>
    </Animated.View>
  )
}

function ContextRow ({ item, onPress, currentGroupSlug, badgeCount = 0, className }) {
  const newPostCount = Math.min(99, item.newPostCount)
  const highlight = item?.slug === currentGroupSlug

  return (
    <TouchableOpacity
      key={item?.id}
      onPress={() => onPress(item)}
      style={styles.rowTouchable}
      activeOpacity={0.7}
    >
      <View
        className={clsx(
          'bg-primary relative flex flex-col items-center justify-center w-14 h-14 min-h-10 rounded-lg drop-shadow-md opacity-60 scale-90',
          highlight && 'border-3 border-secondary opacity-100 scale-100',
          badgeCount > 0 && 'border-3 border-accent opacity-100 scale-100',
          className
        )}
      >
        {!!item?.avatarUrl && (
          <FastImage source={{ uri: item?.avatarUrl }} style={styles.groupAvatar} />
        )}
        {item?.isPublicContext &&
          <View className='flex items-center w-14 h-14 min-h-10 rounded-lg'>
            <Globe />
          </View>}
        {!!newPostCount && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{newPostCount}</Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
  )
}

const styles = StyleSheet.create({
  menuContainer: {
    backgroundColor: '#222',
    overflow: 'hidden',
    paddingVertical: 10
  },
  groupAvatar: {
    height: 30,
    width: 30,
    borderRadius: 4
  },
  expandButton: {
    paddingVertical: 10,
    alignItems: 'center',
    backgroundColor: '#333'
  },
  expandButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: 'bold'
  },
  groupRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 8
  },
  groupIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 10
  },
  groupText: {
    fontSize: 14,
    color: 'white',
    flexShrink: 1
  }
})
