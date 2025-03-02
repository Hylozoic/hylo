import React, { useRef } from 'react'
import { Animated, TouchableOpacity, Text, FlatList } from 'react-native'
import FastImage from 'react-native-fast-image'
import Intercom from '@intercom/intercom-react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
// See https://lucide.dev/guide/packages/lucide-react-native#one-generic-icon-component
// this will "significantly increase the build size of the application"
import { icons } from 'lucide-react-native'
import { map, sortBy } from 'lodash/fp'
import { clsx } from 'clsx'
import useCurrentUser from '@hylo/hooks/useCurrentUser'
import useCurrentGroup, { useContextGroups } from '@hylo/hooks/useCurrentGroup'
import { widgetUrl as makeWidgetUrl } from 'util/navigation'
import { openURL } from 'hooks/useOpenURL'
import useChangeToGroup from 'hooks/useChangeToGroup'

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
    }, 1000) // 2-second delay
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
    }, 1000) // Press & hold for 1 second to expand
  }

  const handlePressOut = () => {
    clearTimeout(pressTimer.current)
  }

  const handleOnPress = context => {
    changeToGroup(context?.slug, false)
    const homePath = context && makeWidgetUrl({
      widget: context?.homeWidget,
      groupSlug: context?.slug
    })
    if (homePath) openURL(homePath)
  }

  return (
    <Animated.View
      className='h-full bg-theme-background z-50'
      style={{ paddingTop: insets.top, paddingBottom: insets.bottom }}
    >
      <FlatList
        data={myGroups}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <ContextRow
            onPress={handleOnPress}
            isExpanded={isExpanded}
            item={item}
            highlight={item?.slug === currentGroup?.slug}
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
        className='bg-primary m-1'
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
        className='bg-primary m-1'
        isExpanded={isExpanded}
        item={{
          name: 'Support',
          iconName: 'CircleHelp'
        }}
        onPress={() => Intercom.present()}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
      />
    </Animated.View>
  )
}

function ContextRow ({
  item,
  onPress,
  highlight,
  badgeCount = 0,
  isExpanded,
  className,
  onPressIn,
  onPressOut
}) {
  const CustomIcon = item?.iconName && icons[item.iconName]
  const newPostCount = Math.min(99, item.newPostCount)

  return (
    <TouchableOpacity
      key={item?.id}
      onPress={() => onPress(item)}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      className={clsx(
        'flex-row rounded-lg opacity-60 p-2',
        badgeCount > 0 && 'border-3 opacity-100',
        highlight && 'p-1 border-2 border-secondary bg-primary',
        className
      )}
      style={{ justifyContent: isExpanded ? 'flex-start' : 'center', alignItems: 'center' }}
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
        <Text className='text-xl font-medium text-foreground ml-2'>{item?.name}</Text>
      )}
    </TouchableOpacity>
  )
}
