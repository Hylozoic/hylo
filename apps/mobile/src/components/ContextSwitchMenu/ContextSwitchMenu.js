import React from 'react'
import { Animated, TouchableOpacity, Text, StyleSheet, View, FlatList } from 'react-native'
import FastImage from 'react-native-fast-image'
import { Globe, Plus, CircleHelp } from 'lucide-react-native'
import { map, sortBy } from 'lodash/fp'
import useCurrentUser from '@hylo/hooks/useCurrentUser'
import useCurrentGroup from '@hylo/hooks/useCurrentGroup'
import { PUBLIC_GROUP } from '@hylo/presenters/GroupPresenter'
import useChangeToGroup from 'hooks/useChangeToGroup'

export default function ContextSwitchMenu () {
  const [{ currentUser }] = useCurrentUser()
  const [{ currentGroup }] = useCurrentGroup()
  const changeToGroup = useChangeToGroup()
  const myGroups = [PUBLIC_GROUP].concat(sortBy('name', map(m => m.group, currentUser.memberships)))

  return (
    <Animated.View className='flex-col h-full bg-theme-background z-50 items-center py-2 px-3'>
      {/* FlatList used instead of FlashList because of strict-sizing requirements of FlashList */}
      <FlatList
        data={myGroups}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <NavRow
            changeToGroup={changeToGroup}
            item={item}
            currentGroupSlug={currentGroup?.slug}
          />
        )}
        showsVerticalScrollIndicator={false}
      />
      <View className='w-full mt-auto bg-theme-background pt-4'>
        <TouchableOpacity 
          onPress={() => {}} // TODO redesign: Needs to open some creation dialog...
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
          onPress={() => {}} // Needs to open some creation dialog?
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

function NavRow ({ item, changeToGroup, currentGroupSlug, badgeCount = 0, className }) {
  const { id, avatarUrl, name, slug } = item
  const newPostCount = Math.min(99, item.newPostCount)
  const highlight = slug === currentGroupSlug

  return (
    <TouchableOpacity
      key={id} 
      onPress={() => changeToGroup(item?.slug, false)}
      style={styles.rowTouchable}
      activeOpacity={0.7}
    >
      <View
        className={[
          'bg-primary relative flex flex-col items-center justify-center w-14 h-14 min-h-10 rounded-lg drop-shadow-md opacity-60 scale-90',
          highlight && 'border-3 border-secondary opacity-100 scale-100',
          badgeCount > 0 && 'border-3 border-accent opacity-100 scale-100',
          className
        ].filter(Boolean).join(' ')}
      >
        {!!avatarUrl && (
          <FastImage source={{ uri: avatarUrl }} style={styles.groupAvatar} />
        )}
        {slug === PUBLIC_GROUP.slug &&
          <View className='flex items-center w-14 h-14 min-h-10 rounded-lg'>
            <Globe />
          </View>
        }
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
