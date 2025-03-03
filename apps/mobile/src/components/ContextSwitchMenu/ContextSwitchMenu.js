import React, { useRef } from 'react'
import { TouchableOpacity, Text, FlatList, View } from 'react-native'
import FastImage from 'react-native-fast-image'
import Intercom from '@intercom/intercom-react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { CircleHelp, Globe, Plus } from 'lucide-react-native'
import { map, sortBy } from 'lodash/fp'
import { clsx } from 'clsx'
import useCurrentUser from '@hylo/hooks/useCurrentUser'
import useCurrentGroup, { useContextGroups } from '@hylo/hooks/useCurrentGroup'
import { widgetUrl as makeWidgetUrl } from 'util/navigation'
import { openURL } from 'hooks/useOpenURL'
import useChangeToGroup from 'hooks/useChangeToGroup'

// Time to keep menu expanded without interaction
const STAY_EXPANDED_DURATION = 1500
// Time to press to expand menu (scroll will also expand, see DrawerMenu)
const PRESS_IN_EXPAND_DURATION = 2000

export default function ContextSwitchMenu ({ isExpanded, setIsExpanded }) {
  const insets = useSafeAreaInsets()
  const changeToGroup = useChangeToGroup()
  const [{ currentUser }] = useCurrentUser()
  const [{ currentGroup }] = useCurrentGroup()
  const { myContext, publicContext } = useContextGroups()
  const myGroups = [myContext, publicContext].concat(
    sortBy('name', map(m => m.group, currentUser.memberships))
  )

  const collapseTimeout = useRef(null)
  const pressTimer = useRef(null)
  const isScrolling = useRef(false)

  const startCollapseTimer = () => {
    clearTimeout(collapseTimeout.current)
    collapseTimeout.current = setTimeout(() => {
      setIsExpanded(false)
    }, STAY_EXPANDED_DURATION)
  }

  const handleScrollStart = () => {
    isScrolling.current = true
    clearTimeout(pressTimer.current)
    setIsExpanded(true)
  }

  const handleScrollStop = () => {
    isScrolling.current = false
    startCollapseTimer()
  }

  const handlePressIn = () => {
    pressTimer.current = setTimeout(() => {
      if (!isScrolling.current) {
        setIsExpanded(true)
      }
    }, PRESS_IN_EXPAND_DURATION) 
  }

  const handlePressOut = () => {
    clearTimeout(pressTimer.current)
  }

  const handleOnPress = context => {
    setIsExpanded(false)
    changeToGroup(context?.slug, false)
    const homePath = context && makeWidgetUrl({
      widget: context?.homeWidget,
      groupSlug: context?.slug
    })
    if (homePath) openURL(homePath)
  }

  return (
    <View
      className='h-full bg-theme-background z-50'
      style={{ paddingTop: insets.top, paddingBottom: insets.bottom }}
    >
      <FlatList
        data={myGroups}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <ContextRow
            isExpanded={isExpanded}
            item={item}
            highlight={item?.slug === currentGroup?.slug}
            onPress={handleOnPress}
            onPressIn={handlePressIn}
            onPressOut={handlePressOut}
          />
        )}
        showsVerticalScrollIndicator={false}
        onScrollBeginDrag={handleScrollStart}
        onScrollEndDrag={handleScrollStop}
        onMomentumScrollEnd={handleScrollStop}
        scrollEventThrottle={16}
      />
      <ContextRow
        bottomItem
        isExpanded={isExpanded}
        item={{
          name: 'Create',
          iconName: 'Plus'
        }}
        onPress={() => openURL('/create')}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
      />
      <ContextRow
        bottomItem
        isExpanded={isExpanded}
        item={{
          name: 'Support',
          iconName: 'CircleHelp'
        }}
        onPress={() => Intercom.present()}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
      />
    </View>
  )
}

function ContextRow ({
  item,
  onPress,
  highlight,
  badgeCount = 0,
  bottomItem,
  isExpanded,
  className,
  onPressIn,
  onPressOut
}) {
  const newPostCount = Math.min(99, item.newPostCount)
  const CustomIcons = { CircleHelp, Globe, Plus }
  const CustomIcon = item?.iconName && CustomIcons[item.iconName]

  return (
    <TouchableOpacity
      key={item?.id}
      onPress={() => onPress(item)}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      className={clsx(
        'flex-row rounded-lg opacity-60 p-2',
        badgeCount > 0 && 'border-3 opacity-100',
        highlight && 'bg-primary border-2 border-secondary p-1',
        bottomItem && 'bg-primary m-1',
        className
      )}
      style={{
        justifyContent: isExpanded ? 'flex-start' : 'center',
        alignItems: 'center'
      }}
      activeOpacity={0.7}
    >
      {!CustomIcon && !!item?.avatarUrl && (
        <FastImage source={{ uri: item?.avatarUrl }} style={{ height: 35, width: 35 }} />
      )}
      {CustomIcon && (
        <CustomIcon size={35} />
      )}
      {!!newPostCount && (
        <Text>{newPostCount}</Text>
      )}
      {isExpanded && (
        <Text
          className={clsx(
            'text-xl font-medium text-background ml-2',
            (highlight || bottomItem) && 'text-foreground'
          )}
        >
          {item?.name}
        </Text>
      )}
    </TouchableOpacity>
  )
}
