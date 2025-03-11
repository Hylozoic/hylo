import React, { useMemo, useEffect } from 'react'
import { View, Text, TouchableOpacity, ScrollView } from 'react-native'
import { useTranslation } from 'react-i18next'
import { useNavigation } from '@react-navigation/native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import useCurrentGroup from '@hylo/hooks/useCurrentGroup'
import { orderContextWidgetsForContextMenu, isHiddenInContextMenuResolver, translateTitle } from '@hylo/presenters/ContextWidgetPresenter'
import useContextWidgetChildren from '@hylo/hooks/useContextWidgetChildren'
import useHasResponsibility, { RESP_ADD_MEMBERS, RESP_ADMINISTRATION } from '@hylo/hooks/useHasResponsibility'
import { widgetUrl as makeWidgetUrl } from 'util/navigation'
import useLogout from 'hooks/useLogout'
import useOpenURL from 'hooks/useOpenURL'
import useRouteParams from 'hooks/useRouteParams'
import GroupMenuHeader from 'components/GroupMenuHeader'
import WidgetIconResolver from 'components/WidgetIconResolver'

export default function ContextMenu () {
  const insets = useSafeAreaInsets()
  const navigation = useNavigation()
  const { t } = useTranslation()
  const openURL = useOpenURL()
  const [{ currentGroup, fetching }] = useCurrentGroup()
  const widgets = useMemo(() =>
    orderContextWidgetsForContextMenu(currentGroup?.contextWidgets || []),
  [currentGroup?.contextWidgets])

  // TODO: May be more appropriately put on AuthRootNavigator after useHandleLinking
  useEffect(() => {
    if ((!fetching && currentGroup?.shouldWelcome)) {
      navigation.replace('Group Welcome')
    }
  }, [fetching, currentGroup])

  const handleGoToAllViews = () => openURL(
    makeWidgetUrl({
      widget: {
        type: 'all-views',
        view: 'all-views'
      },
      rootPath: `/groups/${currentGroup?.slug}`,
      groupSlug: currentGroup?.slug
    }),
    { replace: true }
  )

  if (!currentGroup) return null

  return (
    <View className='flex-1 bg-background' style={{ paddingBottom: insets.bottom }}>
      <ContextHeader group={currentGroup} />
      <ScrollView className='p-2'>
        {widgets.map((widget, key) => (
          <View key={key} className='mb-0.5'>
            <ContextItem
              widget={widget}
              groupSlug={currentGroup.slug}
              rootPath={`/groups/${currentGroup.slug}`}
              group={currentGroup}
            />
          </View>
        ))}
      </ScrollView>
      {(!currentGroup.isContextGroup) && (
        <View className='px-2 mb-2'>
          <TouchableOpacity
            onPress={handleGoToAllViews}
            className='flex-row items-center p-3 bg-background border-2 border-foreground/20 rounded-md gap-2'
          >
            <WidgetIconResolver widget={{ type: 'all-views' }} className='mr-2' />
            <Text className='text-base font-normal text-foreground'>{t('All Views')}</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  )
}

function ContextHeader ({ group, style }) {
  const { t } = useTranslation()
  const insets = useSafeAreaInsets()

  if (!group) return null

  return (
    <View className='w-full relative' style={style}>
      {!group.isContextGroup && (
        <GroupMenuHeader group={group} />
      )}
      {group.isContextGroup && (
        <View className='flex flex-col p-2' style={{ paddingTop: insets.top }}>
          <Text className='text-foreground font-bold text-lg'>
            {t(group.name)}
          </Text>
        </View>
      )}
    </View>
  )
}

function ContextItem ({ widget, groupSlug, rootPath, group }) {
  const { t } = useTranslation()
  const { listItems, loading } = useContextWidgetChildren({ widget, groupSlug })
  const openURL = useOpenURL()
  const logout = useLogout()
  const hasResponsibility = useHasResponsibility({ forCurrentGroup: true, forCurrentUser: true })
  const canAdmin = hasResponsibility(RESP_ADMINISTRATION)
  const [{ currentGroup }] = useCurrentGroup()
  const routeParams = useRouteParams()

  const title = translateTitle(widget.title, t)
  const url = makeWidgetUrl({ widget, rootPath, groupSlug })
  const isActive = useMemo(() => {
    if (!url || !routeParams.originalLinkingPath) return false
    // Remove any trailing slashes for comparison
    const cleanUrl = url.replace(/\/$/, '')
    const cleanPath = routeParams.originalLinkingPath.replace(/\/$/, '')
    return cleanPath === cleanUrl || cleanPath.startsWith(cleanUrl + '/')
  }, [url, routeParams.originalLinkingPath])

  const handleWidgetPress = widget => {
    const linkingPath = makeWidgetUrl({ widget, rootPath, groupSlug: currentGroup?.slug })
    openURL(linkingPath, { replace: true })
  }

  if (isHiddenInContextMenuResolver(widget)) return null
  if (widget.visibility === 'admin' && !canAdmin) return null

  if (widget.type === 'logout') {
    return (
      <TouchableOpacity
        onPress={() => logout()}
        className='flex-row items-center p-3 bg-background border-2 border-foreground/20 rounded-md mb-2 gap-2'
      >
        <WidgetIconResolver widget={widget} className='mr-2' style={{ fontSize: 18 }} />
        <Text className='text-base font-normal text-foreground'>{title}</Text>
      </TouchableOpacity>
    )
  }

  if (url && (widget.childWidgets.length === 0 && !['members', 'about'].includes(widget.type))) {
    return (
      <TouchableOpacity
        onPress={() => handleWidgetPress(widget)}
        className={`
          w-full flex-row items-center p-3 bg-background border-2 rounded-md mb-2 gap-2
          ${isActive ? 'border-selected bg-selected/10 opacity-100' : 'border-foreground/20'}
        `}
      >
        <WidgetIconResolver widget={widget} className='mr-2' style={{ fontSize: 18 }} />
        <Text className={`text-base font-normal ${isActive ? 'text-selected text-opacity-100' : 'text-foreground'}`}>{title}</Text>
      </TouchableOpacity>
    )
  }

  return (
    <View className='w-full rounded-md p-2 bg-background mb-0.5'>
      <TouchableOpacity
        onPress={widget.view && (() => handleWidgetPress(widget))}
        className='w-full flex-row justify-between items-center'
      >
        <Text className={`text-base font-light opacity-50 ${isActive ? 'text-selected text-opacity-100' : 'text-foreground'}`}>{title}</Text>
      </TouchableOpacity>
      <View className='w-full flex flex-col justify-center items-center relative'>
        <ContextItemActions widget={widget} group={group} />
      </View>
      {loading && <Text className='text-foreground'>{t('Loading...')}</Text>}
      {listItems.length > 0 && listItems.map((item, key) =>
        <ContextItemChild
          key={key}
          widget={item}
          rootPath={rootPath}
          groupSlug={groupSlug}
          handleWidgetPress={handleWidgetPress}
          parentUrl={url}
        />
      )}
    </View>
  )
}

function ContextItemChild ({ widget, handleWidgetPress, rootPath, groupSlug, parentUrl }) {
  const { t } = useTranslation()
  const routeParams = useRouteParams()
  const url = makeWidgetUrl({ widget, rootPath, groupSlug })
  const isActive = useMemo(() => {
    if (!url || !routeParams.originalLinkingPath) return false
    // Remove any trailing slashes for comparison
    const cleanUrl = url.replace(/\/$/, '')
    const cleanPath = routeParams.originalLinkingPath.replace(/\/$/, '')
    return cleanPath === cleanUrl || cleanPath.startsWith(cleanUrl + '/')
  }, [url, routeParams.originalLinkingPath])

  return (
    <TouchableOpacity
      key={widget.id + widget.title}
      onPress={() => handleWidgetPress(widget)}
      className={`
        w-full flex-row items-center p-3 bg-background border-2 rounded-md mb-2 gap-2
        ${isActive ? 'border-selected bg-selected/10 opacity-100' : 'border-foreground/20'}
      `}
    >
      <WidgetIconResolver widget={widget} className='mr-2' style={{ fontSize: 18 }} />
      <Text className={`text-base font-normal ${isActive ? 'text-selected text-opacity-100' : 'text-foreground'}`}>
        {translateTitle(widget.title, t)}
      </Text>
    </TouchableOpacity>
  )
}

function ContextItemActions ({ widget, group }) {
  const hasResponsibility = useHasResponsibility({ forCurrentGroup: true, forCurrentUser: true })
  const canAddMembers = hasResponsibility(RESP_ADD_MEMBERS)

  if (widget.type === 'members' && canAddMembers) {
    return (
      <ContextItemActionLink title='Add Members' url={`/groups/${group.slug}/settings/invite`} />
    )
  }

  if (widget.type === 'about') {
    return (
      <View className='mb-4'>
        <Text className='text-sm text-gray-600 mb-2'>{group.purpose}</Text>
        <Text className='text-sm text-gray-600'>{group.description}</Text>
      </View>
    )
  }

  if (widget.type === 'setup') {
    const settingsDetailsPath = `/groups/${group.slug}/settings/details`
    return (
      <View className='w-full mb-2'>
        <ContextItemActionLink title='Settings' path={`/groups/${group.slug}/settings`} />
        <View className='w-full'>
          {!group.avatarUrl && (
            <ContextItemActionLink title='Add Avatar' path={settingsDetailsPath} />
          )}
          {!group.bannerUrl && (
            <ContextItemActionLink title='Add Banner' path={settingsDetailsPath} />
          )}
          {!group.purpose && (
            <ContextItemActionLink title='Add Purpose' path={settingsDetailsPath} />
          )}
          {(
            !group.description ||
            group.description === 'This is a long-form description of the group' ||
            group.description === ''
          ) && (
            <ContextItemActionLink title='Add Description' path={settingsDetailsPath} />
          )}
          {!group.locationObject && (
            <ContextItemActionLink title='Add Location' path={settingsDetailsPath} />
          )}
        </View>
      </View>
    )
  }
}

function ContextItemActionLink ({ title, path }) {
  const { t } = useTranslation()
  const openURL = useOpenURL()
  return (
    <TouchableOpacity
      onPress={() => openURL(path, { replace: true })}
      className='w-full'
    >
      <View className='w-full border-2 border-foreground/20 rounded-md p-2 mb-2 bg-background'>
        <Text className='text-base text-foreground'>{t(title)}</Text>
      </View>
    </TouchableOpacity>
  )
}
