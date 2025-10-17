import React, { useRef } from 'react'
import { Text, FlatList, View, TouchableOpacity } from 'react-native'
import FastImage from 'react-native-fast-image'
import Intercom from '@intercom/intercom-react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { map, sortBy } from 'lodash/fp'
import { clsx } from 'clsx'
import GroupPresenter from '@hylo/presenters/GroupPresenter'
import useCurrentUser from '@hylo/hooks/useCurrentUser'
import useCurrentGroup from '@hylo/hooks/useCurrentGroup'
import useStaticContexts from '@hylo/hooks/useStaticContexts'
import { useChangeToGroup } from 'hooks/useHandleCurrentGroup'
import { isIOS } from 'util/platform'
import useOpenURL from 'hooks/useOpenURL'
import LucideIcon from 'components/LucideIcon'
import { black, white } from '@hylo/presenters/colors'

const STAY_EXPANDED_DURATION = 1500

export default function ContextSwitchMenu ({ isExpanded, setIsExpanded, fullView }) {
  const insets = useSafeAreaInsets()
  const openURL = useOpenURL()
  const changeToGroup = useChangeToGroup()
  const [{ currentUser }] = useCurrentUser()
  const [{ currentGroup }] = useCurrentGroup()
  const { myContext, publicContext } = useStaticContexts()

  // Separate memberships into pinned and unpinned
  const memberships = currentUser?.memberships || []
  const pinnedMemberships = memberships.filter(m => m.navOrder !== null && m.navOrder !== undefined)
  const unpinnedMemberships = memberships.filter(m => m.navOrder === null || m.navOrder === undefined)

  // Sort pinned by navOrder, unpinned by group name
  const sortedPinnedGroups = pinnedMemberships
    .sort((a, b) => a.navOrder - b.navOrder)
    .map(m => m.group ? GroupPresenter(m.group) : null)
    .filter(Boolean) // Remove null entries

  const sortedUnpinnedGroups = unpinnedMemberships
    .sort((a, b) => (a.group?.name || '').localeCompare(b.group?.name || ''))
    .map(m => m.group ? GroupPresenter(m.group) : null)
    .filter(Boolean) // Remove null entries

  // Compose the final list with a divider marker
  const myGroups = [
    GroupPresenter(myContext),
    GroupPresenter(publicContext),
    ...sortedPinnedGroups,
    { __divider: true, id: '__divider' },
    ...sortedUnpinnedGroups
  ]

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
    changeToGroup(context?.slug, { navigateHome: true })
  }

  return (
    <View
      className='h-full bg-theme-background z-50'
      style={{ paddingTop: fullView ? 5 : insets.top + (isIOS ? 0 : 20), paddingBottom: fullView ? 5 : insets.bottom + (isIOS ? 0 : 20) }}
    >
      <FlatList
        data={myGroups}
        keyExtractor={item => item.id || item.slug || Math.random().toString()}
        renderItem={({ item }) => (
          item.__divider ? (
            <View style={{ height: 1, backgroundColor: '#ccc', marginVertical: 8, marginHorizontal: 12 }} />
          ) : (
            <ContextRow
              context={item}
              isExpanded={isExpanded}
              selected={item?.slug === currentGroup?.slug}
              onPress={handleOnPress}
            />
          )
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

  return (
    <TouchableOpacity
      onPress={() => onPress(context)}
      className={clsx(
        'flex-row rounded-lg bg-primary m-1.5',
        !selected && !bottomItem && 'border-1 border-primary opacity-60 p-1',
        selected && 'border-3 border-selected opacity-100 p-0.5',
        bottomItem && 'bg-primary m-1 p-1 opacity-60',
        className
      )}
      style={{
        justifyContent: isExpanded ? 'flex-start' : 'center',
        alignItems: 'center'
      }}
      activeOpacity={0.5}
    >
      <View>
        {context?.iconName && (
          <LucideIcon name={context.iconName} color={bottomItem ? black : white} size={bottomItem ? 24 : 35} />
        )}
        {!context?.iconName && (
          <FastImage source={{ uri: context?.avatarUrl }} style={{ height: 35, width: 35 }} />
        )}
        {!!newPostCount && (
          <Text>{newPostCount}</Text>
        )}
      </View>
      {isExpanded && (
        <Text
          className={clsx(
            'text-xl font-medium text-foreground ml-2'
            // (selected || bottomItem) && 'text-foreground'
          )}
        >
          {context?.name}
        </Text>
      )}
    </TouchableOpacity>
  )
}
