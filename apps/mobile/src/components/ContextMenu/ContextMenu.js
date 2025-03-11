import React, { useMemo, useEffect } from 'react'
import { View, Text, TouchableOpacity, ScrollView } from 'react-native'
import { useTranslation } from 'react-i18next'
import { useNavigation } from '@react-navigation/native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { TextHelpers } from '@hylo/shared'
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
      <View className='w-full relative'>
        {!currentGroup.isContextGroup && (
          <GroupMenuHeader group={currentGroup} />
        )}
        {currentGroup.isContextGroup && (
          <View className='flex flex-col p-2' style={{ paddingTop: insets.top }}>
            <Text className='text-foreground font-bold text-lg'>
              {t(currentGroup.name)}
            </Text>
          </View>
        )}
      </View>
      <ScrollView className='p-2'>
        {widgets.map((widget, key) => (
          <View key={key} className='mb-0.5'>
            <ContextWidget
              widget={widget}
              groupSlug={currentGroup.slug}
              rootPath={`/groups/${currentGroup.slug}`}
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
            <WidgetIconResolver widget={{ type: 'all-views' }} />
            <Text className='text-base font-normal text-foreground'>{t('All Views')}</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  )
}

function ContextWidget ({ widget, groupSlug }) {
  const { t } = useTranslation()
  const { listItems: childWidgets, loading } = useContextWidgetChildren({ widget, groupSlug })
  const openURL = useOpenURL()
  const logout = useLogout()
  const hasResponsibility = useHasResponsibility({ forCurrentGroup: true, forCurrentUser: true })
  const canAdmin = hasResponsibility(RESP_ADMINISTRATION)
  const routeParams = useRouteParams()

  const rootPath = `/groups/${groupSlug}`
  const title = translateTitle(widget.title, t)
  const widgetPath = makeWidgetUrl({ widget, rootPath, groupSlug })
  const isActive = useMemo(() => {
    const currentPath = routeParams?.originalLinkingPath
    if (!widgetPath || !currentPath) return false
    return currentPath === widgetPath || currentPath.startsWith(widgetPath + '/')
  }, [widgetPath, routeParams.originalLinkingPath])

  const handleWidgetPress = widget => {
    const linkingPath = makeWidgetUrl({ widget, rootPath, groupSlug })
    openURL(linkingPath, { replace: true })
  }

  if (!widget || isHiddenInContextMenuResolver(widget) || (widget.visibility === 'admin' && !canAdmin)) {
    return null
  }

  if (widget.type === 'logout') {
    return (
      <TouchableOpacity
        onPress={() => logout()}
        className='flex-row items-center p-3 bg-background border-2 border-foreground/20 rounded-md mb-2 gap-2'
      >
        <WidgetIconResolver widget={widget} style={{ fontSize: 18 }} />
        <Text className='text-base font-normal text-foreground'>{title}</Text>
      </TouchableOpacity>
    )
  }

  if (widgetPath && (widget.childWidgets.length === 0 && !['members', 'about'].includes(widget.type))) {
    return (
      <TouchableOpacity
        onPress={() => handleWidgetPress(widget)}
        className={`
          w-full flex-row items-center p-3 bg-background border-2 rounded-md mb-2 gap-2
          ${isActive ? 'border-selected bg-selected/10 opacity-100' : 'border-foreground/20'}
        `}
      >
        <WidgetIconResolver widget={widget} style={{ fontSize: 18 }} />
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
        <ContextWidgetActions widget={widget} />
      </View>
      {loading && <Text className='text-foreground'>{t('Loading...')}</Text>}
      {childWidgets.length > 0 && childWidgets.map((childWidget, key) =>
        <ContextWidgetChild
          key={key}
          widget={childWidget}
          rootPath={rootPath}
          groupSlug={groupSlug}
          handleWidgetPress={handleWidgetPress}
        />
      )}
    </View>
  )
}

function ContextWidgetChild ({ widget, handleWidgetPress, rootPath, groupSlug }) {
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
      <WidgetIconResolver widget={widget} style={{ fontSize: 18 }} />
      <Text className={`text-base font-normal ${isActive ? 'text-selected text-opacity-100' : 'text-foreground'}`}>
        {translateTitle(widget.title, t)}
      </Text>
    </TouchableOpacity>
  )
}

function ContextWidgetActions ({ widget }) {
  const [{ currentGroup }] = useCurrentGroup()
  const hasResponsibility = useHasResponsibility({ forCurrentGroup: true, forCurrentUser: true })
  const canAddMembers = hasResponsibility(RESP_ADD_MEMBERS)

  if (!currentGroup) return null

  if (widget.type === 'members' && canAddMembers) {
    return (
      <ContextWidgetActionLink title='Add Members' widget={widget} path={`/groups/${currentGroup.slug}/settings/invite`} />
    )
  }

  if (widget.type === 'about') {
    return (
      <View className='mb-4'>
        <Text className='text-sm text-gray-600 mb-2'>{currentGroup.purpose}</Text>
        <Text className='text-sm text-gray-600'>{TextHelpers.markdown(currentGroup.description)}</Text>
      </View>
    )
  }

  if (widget.type === 'setup') {
    const settingsDetailsPath = `/groups/${currentGroup.slug}/settings/details`
    return (
      <View className='w-full mb-2'>
        <ContextWidgetActionLink title='Settings' path={`/groups/${currentGroup.slug}/settings`} />
        <View className='w-full'>
          {!currentGroup.avatarUrl && (
            <ContextWidgetActionLink title='Add Avatar' path={settingsDetailsPath} />
          )}
          {!currentGroup.bannerUrl && (
            <ContextWidgetActionLink title='Add Banner' path={settingsDetailsPath} />
          )}
          {!currentGroup.purpose && (
            <ContextWidgetActionLink title='Add Purpose' path={settingsDetailsPath} />
          )}
          {(
            !currentGroup.description ||
            currentGroup.description === 'This is a long-form description of the group' ||
            currentGroup.description === ''
          ) && (
            <ContextWidgetActionLink title='Add Description' path={settingsDetailsPath} />
          )}
          {!currentGroup.locationObject && (
            <ContextWidgetActionLink title='Add Location' path={settingsDetailsPath} />
          )}
        </View>
      </View>
    )
  }
}

function ContextWidgetActionLink ({ title, path, widget }) {
  const { t } = useTranslation()
  const openURL = useOpenURL()

  return (
    <TouchableOpacity onPress={() => openURL(path, { replace: true })} className='w-full'>
      <View className='w-full border-2 border-foreground/20 rounded-md p-2 mb-2 gap-2 bg-background flex-row'>
        <WidgetIconResolver widget={widget} style={{ fontSize: 18 }} />
        <Text className='text-base text-foreground'>{t(title || widget?.title)}</Text>
      </View>
    </TouchableOpacity>
  )
}
