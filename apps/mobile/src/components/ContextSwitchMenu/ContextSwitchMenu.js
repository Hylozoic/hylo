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
import useOpenURL from 'hooks/useOpenURL'
import useChangeToGroup from 'hooks/useChangeToGroup'
import { black, white } from 'style/colors'

const STAY_EXPANDED_DURATION = 1500

export default function ContextSwitchMenu ({ isExpanded, setIsExpanded }) {
  const insets = useSafeAreaInsets()
  const openURL = useOpenURL()
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

  const handleScroll = (evt) => {
    setIsExpanded(true)
    clearTimeout(collapseTimeout.current)
  }

  const handleScrollStop = () => {
    startCollapseTimer()
  }

  const handleOnPress = context => {
    clearTimeout(collapseTimeout.current)
    setIsExpanded(false)
    changeToGroup(context?.slug, false)
    const homePath = context && makeWidgetUrl({
      widget: context?.homeWidget,
      groupSlug: context?.slug
    })
    if (homePath) openURL(homePath, { replace: true })
  }

  return (
    <View
      className='h-full bg-theme-background z-50'
      style={{ paddingTop: insets.top, paddingBottom: insets.bottom }}
    >
      <FlatList
        data={myGroups}
        keyExtractor={(item) => item.id}
        on
        renderItem={({ item }) => (
          <ContextRow
            context={item}
            isExpanded={isExpanded}
            selected={item?.slug === currentGroup?.slug}
            onPress={handleOnPress}
          />
        )}
        showsVerticalScrollIndicator={false}
        onScrollBeginDrag={handleScroll}
        onScrollEndDrag={handleScrollStop}
        onMomentumScrollEnd={handleScrollStop}
        scrollEventThrottle={16}
      />
      <ContextRow
        bottomItem
        context={{ name: 'Create', iconName: 'Plus' }}
        isExpanded={isExpanded}
        onPress={() => openURL('/create')}
      />
      <ContextRow
        bottomItem
        context={{ name: 'Support', iconName: 'CircleHelp' }}
        isExpanded={isExpanded}
        onPress={() => Intercom.present()}
      />
    </View>
  )
}

function ContextRow ({
  badgeCount = 0,
  bottomItem,
  className,
  context,
  selected,
  isExpanded,
  onPress
}) {
  const newPostCount = Math.min(99, context.newPostCount)
  const CustomIcons = { CircleHelp, Globe, Plus }
  const CustomIcon = context?.iconName && CustomIcons[context.iconName]

  return (
    <TouchableOpacity
      key={context?.id}
      onPress={() => onPress(context)}
      className={clsx(
        'flex-row rounded-lg p-1.5',
        selected && 'bg-primary',
        bottomItem && 'bg-primary m-1',
        className
      )}
      style={{
        justifyContent: isExpanded ? 'flex-start' : 'center',
        alignItems: 'center'
      }}
      activeOpacity={0.7}
    >
      {!CustomIcon && !!context?.avatarUrl && (
        <FastImage source={{ uri: context?.avatarUrl }} style={{ height: 35, width: 35 }} />
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
            (selected || bottomItem) && 'text-foreground'
          )}
        >
          {context?.name}
        </Text>
      )}
    </TouchableOpacity>
  )
}
