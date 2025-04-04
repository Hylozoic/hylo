import React, { useMemo } from 'react'
import { View, Text, TouchableOpacity, ScrollView } from 'react-native'
import { useTranslation } from 'react-i18next'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { TextHelpers } from '@hylo/shared'
import useCurrentUser from '@hylo/hooks/useCurrentUser'
import useCurrentGroup from '@hylo/hooks/useCurrentGroup'
import {
  orderContextWidgetsForContextMenu,
  isHiddenInContextMenuResolver,
  translateTitle,
  allViewsWidget
} from '@hylo/presenters/ContextWidgetPresenter'
import useContextWidgetChildren from '@hylo/hooks/useContextWidgetChildren'
import useHasResponsibility, { RESP_ADD_MEMBERS, RESP_ADMINISTRATION } from '@hylo/hooks/useHasResponsibility'
import { isIOS } from 'util/platform'
import { widgetUrl as makeWidgetUrl } from 'util/navigation'
import useLogout from 'hooks/useLogout'
import useOpenURL from 'hooks/useOpenURL'
import useRouteParams from 'hooks/useRouteParams'
import GroupMenuHeader from 'components/GroupMenuHeader'
import WidgetIconResolver from 'components/WidgetIconResolver'

export default function ContextMenu () {
  const insets = useSafeAreaInsets()
  const { t } = useTranslation()
  const [{ currentUser }] = useCurrentUser()
  const [{ currentGroup }] = useCurrentGroup()
  const widgets = orderContextWidgetsForContextMenu(
    currentGroup?.getContextWidgets(currentUser) || []
  )

  if (!currentGroup) return null

  return (
    <View className='flex-1 bg-background'>
      <View>
        {!currentGroup.isStaticContext && (
          <GroupMenuHeader group={currentGroup} />
        )}
        {currentGroup.isStaticContext && (
          <View className='flex-col p-2' style={{ paddingTop: insets.top + (isIOS ? 0 : 20) }}>
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
        {!currentGroup.isStaticContext && (
          <View className='mb-0.5'>
            <ContextWidget
              widget={allViewsWidget}
              groupSlug={currentGroup.slug}
              rootPath={`/groups/${currentGroup.slug}`}
            />
          </View>
        )}
        <View style={{ marginBottom: insets.bottom + 20 }} />
      </ScrollView>
    </View>
  )
}

function ContextWidget ({ widget, groupSlug }) {
  const { t } = useTranslation()
  const { contextWidgetChildren: widgetChildren, loading } = useContextWidgetChildren({ widget, groupSlug })
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
    if (widget.type === 'logout') return logout()
    widget?.customView?.externalLink
      ? openURL(widget.customView.externalLink)
      : openURL(makeWidgetUrl({ widget, rootPath, groupSlug }), { replace: true })
  }

  if (!widget || isHiddenInContextMenuResolver(widget) || (widget.visibility === 'admin' && !canAdmin)) {
    return null
  }

  if (widgetPath && (widget.childWidgets.length === 0 && !['members', 'about'].includes(widget.type))) {
    return (
      <View className='rounded-md p-2 bg-background mb-0.5'>
        <TouchableOpacity
          onPress={() => handleWidgetPress(widget)}
          className={`
            flex-row items-center p-3 bg-background border-2 rounded-md mb-2 gap-2
            ${isActive ? 'border-selected opacity-100' : 'border-foreground/20'}
          `}
        >
          <WidgetIconResolver widget={widget} />
          <Text className='text-base font-normal text-foreground'>{title}</Text>
        </TouchableOpacity>
      </View>
    )
  }

  return (
    <View className='rounded-md p-2 bg-background mb-0.5'>
      <TouchableOpacity
        onPress={widget.view && (() => handleWidgetPress(widget))}
        className='flex-row justify-between items-center'
      >
        <Text className='text-base font-light opacity-50 text-foreground'>{title}</Text>
      </TouchableOpacity>
      <View>
        <ContextWidgetActions widget={widget} />
        {loading && (
          <Text className='text-foreground'>{t('Loading...')}</Text>
        )}
        {widgetChildren.map((childWidget, key) =>
          <ContextWidgetChild
            key={key}
            widget={childWidget}
            rootPath={rootPath}
            groupSlug={groupSlug}
            handleWidgetPress={handleWidgetPress}
          />
        )}
      </View>
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
      onPress={() => handleWidgetPress(widget)}
      className={`
        flex-row items-center p-3 bg-background border-2 rounded-md mb-2 gap-2
        ${isActive ? 'border-selected opacity-100' : 'border-foreground/20'}
      `}
    >
      <WidgetIconResolver widget={widget} />
      <Text className='text-base font-normal'>
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
      <ContextWidgetActionLink widget={{ title: 'Add Members', iconName: 'UserPlus' }} path={`/groups/${currentGroup.slug}/settings/invite`} />
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
    const settingsDetailsPath = `/groups/${currentGroup.slug}/settings`
    return (
      <View className='mb-2'>
        <ContextWidgetActionLink title='Settings' path={`/groups/${currentGroup.slug}/settings/index`} />
        <View>
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

function ContextWidgetActionLink ({ iconName, title, path, widget }) {
  const { t } = useTranslation()
  const openURL = useOpenURL()

  return (
    <TouchableOpacity
      onPress={() => openURL(path, { replace: true })}
      className='border-2 border-foreground/20 rounded-md p-2 mb-2 gap-2 bg-background flex-row'
    >
      <WidgetIconResolver iconName={iconName} widget={widget} />
      <Text className='text-base text-foreground'>{t(title || widget?.title)}</Text>
    </TouchableOpacity>
  )
}
