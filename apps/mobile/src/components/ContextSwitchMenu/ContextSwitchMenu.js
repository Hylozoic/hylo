import React, { useRef } from 'react'
import { Text, FlatList, View, TouchableOpacity } from 'react-native'
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
import { black, white } from 'style/colors'

const STAY_EXPANDED_DURATION = 1500

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

  const startCollapseTimer = () => {
    clearTimeout(collapseTimeout.current)
    collapseTimeout.current = setTimeout(() => {
      setIsExpanded(false)
    }, STAY_EXPANDED_DURATION)
  }

  const handleScroll = () => {
    setIsExpanded(true)
    clearTimeout(collapseTimeout.current)
  }

  const handleScrollStop = () => {
    startCollapseTimer()
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
          />
        )}
        showsVerticalScrollIndicator={false}
        onScroll={handleScroll}
        onScrollEndDrag={handleScrollStop}
        onMomentumScrollEnd={handleScrollStop}
        scrollEventThrottle={16}
      />
      <ContextRow
        bottomItem
        isExpanded={isExpanded}
        item={{ name: 'Create', iconName: 'Plus' }}
        onPress={() => openURL('/create')}
      />
      <ContextRow
        bottomItem
        isExpanded={isExpanded}
        item={{ name: 'Support', iconName: 'CircleHelp' }}
        onPress={() => Intercom.present()}
      />
    </View>
  )
}

function ContextRow ({
  badgeCount = 0,
  bottomItem,
  className,
  highlight,
  isExpanded,
  item,
  onPress
}) {
  const newPostCount = Math.min(99, item.newPostCount)
  const CustomIcons = { CircleHelp, Globe, Plus }
  const CustomIcon = item?.iconName && CustomIcons[item.iconName]

  return (
    <TouchableOpacity
      key={item?.id}
      onPress={() => onPress(item)}
      className={clsx(
        'flex-row rounded-lg p-1.5',
        highlight && 'bg-primary',
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
        <CustomIcon style={{ color: bottomItem ? black : white }} size={bottomItem ? 24 : 35} />
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
