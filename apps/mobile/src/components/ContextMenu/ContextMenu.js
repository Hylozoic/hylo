import React, { useMemo, useEffect } from 'react'
import { View, Text, TouchableOpacity, ScrollView } from 'react-native'
import { useTranslation } from 'react-i18next'
import { useNavigation } from '@react-navigation/native'
import { widgetUrl as makeWidgetUrl, groupUrl } from 'util/navigation'
import useCurrentGroup from '@hylo/hooks/useCurrentGroup'
import { orderContextWidgetsForContextMenu, isHiddenInContextMenuResolver } from '@hylo/presenters/ContextWidgetPresenter'
import useContextWidgetChildren from '@hylo/hooks/useContextWidgetChildren'
import useHasResponsibility, { RESP_ADD_MEMBERS, RESP_ADMINISTRATION } from '@hylo/hooks/useHasResponsibility'
import useLogout from 'hooks/useLogout'
import WidgetIconResolver from 'components/WidgetIconResolver'
import GroupMenuHeader from 'components/GroupMenuHeader'
import { openURL } from 'hooks/useOpenURL'

export default function ContextMenu () {
  const navigation = useNavigation()
  const { t } = useTranslation()
  const [{ currentGroup, fetching }] = useCurrentGroup()
  const widgets = useMemo(() => orderContextWidgetsForContextMenu(currentGroup?.contextWidgets || []), [currentGroup?.contextWidgets])

  useEffect(() => {
    if ((!fetching && currentGroup?.shouldWelcome)) {
      navigation.navigate('Group Welcome', { groupId: currentGroup?.id })
    }
  }, [currentGroup, fetching])

  if (!currentGroup) return null

  return (
    <View className='flex-1 bg-background'>
      <Header group={currentGroup} />
      <ScrollView className='p-2'>
        {widgets.map(widget => (
          <View key={widget.id} className='mb-1'>
            <MenuItem
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
            onPress={() => openURL(makeWidgetUrl({ widget: { type: 'all-views', view: 'all-views' }, rootPath: `/groups/${currentGroup.slug}`, groupSlug: currentGroup?.slug }))}
            className='flex-row items-center p-3 bg-background border-2 border-foreground/20 rounded-md gap-2'
          >
            <WidgetIconResolver widget={{ type: 'all-views' }} className='mr-2' />
            <Text className='text-sm font-bold text-foreground'>{t('All Views')}</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  )
}

function MenuItem ({ widget, groupSlug, rootPath, group }) {
  const { t } = useTranslation()
  const { listItems, loading } = useContextWidgetChildren({ widget, groupSlug })
  const logout = useLogout()
  const hasResponsibility = useHasResponsibility({ forCurrentGroup: true, forCurrentUser: true })
  const canAdmin = hasResponsibility(RESP_ADMINISTRATION)
  const [{ currentGroup }] = useCurrentGroup()

  const title = t(widget.title)
  const url = makeWidgetUrl({ widget, rootPath, groupSlug })
  // TODO: Now that we re-map /all to /my, which is helping elsewhere, it will break here when the
  // URL that will be build for /all/stream is /my/stream
  const handleWidgetPress = widget => {
    const linkingPath = makeWidgetUrl({ widget, rootPath, groupSlug: currentGroup?.slug })
    openURL(linkingPath)
  }

  if (isHiddenInContextMenuResolver(widget)) return null
  if (widget.visibility === 'admin' && !canAdmin) return null

  if (widget.type === 'logout') {
    return (
      <TouchableOpacity
        onPress={() => logout()}
        className='flex-row items-center p-3 bg-background border-2 border-foreground/20 rounded-md mb-2 gap-2'
      >
        <WidgetIconResolver widget={widget} className='mr-2' />
        <Text className='text-sm font-bold text-foreground'>{title}</Text>
      </TouchableOpacity>
    )
  }

  if (url && (widget.childWidgets.length === 0 && !['members', 'about'].includes(widget.type))) {
    return (
      <TouchableOpacity
        onPress={() => handleWidgetPress(widget)}
        className='flex-row items-center p-3 bg-background border-2 border-foreground/20 rounded-md mb-2 gap-2'
      >
        <WidgetIconResolver widget={widget} className='mr-2' />
        <Text className='text-sm font-bold text-foreground'>{title}</Text>
      </TouchableOpacity>
    )
  }

  return (
    <View className='border-2 border-foreground/20 rounded-md p-2 bg-background text-foreground mb-[.5rem]'>
      <TouchableOpacity
        onPress={widget.view && (() => handleWidgetPress(widget))}
        className='flex-row justify-between items-center content-center'
      >
        <Text className='text-sm font-semibold text-foreground'>{title}</Text>
      </TouchableOpacity>
      <View className='flex flex-col justify-center items-center relative'>
        <TopElements widget={widget} group={group} />
      </View>
      {loading && <Text>{t('Loading...')}</Text>}
      {listItems.length > 0 && listItems.map(item =>
        <ChildWidget
          key={item.id}
          widget={item}
          rootPath={rootPath}
          groupSlug={groupSlug}
          handleWidgetPress={handleWidgetPress}
        />
      )}
    </View>
  )
}

function ChildWidget ({ widget, handleWidgetPress }) {
  const { t } = useTranslation()
  return (
    <TouchableOpacity
      key={widget.id + widget.title}
      onPress={() => handleWidgetPress(widget)}
      className='flex-row items-center ml-8 h-12 py-2 gap-2 content-center border-b border-foreground/20'
    >
      <View className='w-5'><WidgetIconResolver widget={widget} className='mr-2' /></View>
      <Text className='text-sm text-primary-accent'>{t(widget.title)}</Text>
    </TouchableOpacity>
  )
}

function TopElements ({ widget, group }) {
  const { t } = useTranslation()
  const navigation = useNavigation()
  const hasResponsibility = useHasResponsibility({ forCurrentGroup: true, forCurrentUser: true })
  const canAddMembers = hasResponsibility(RESP_ADD_MEMBERS)

  if (widget.type === 'members' && canAddMembers) {
    return (
      <TouchableOpacity
        onPress={() => navigation.navigate('Group Settings', { groupSlug: group?.slug, screen: 'invite' })}
        className='px-4 py-2 bg-primary rounded-md'
      >
        <Text className='text-sm font-medium text-white'>{t('Add Members')}</Text>
      </TouchableOpacity>
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
    const settingsUrl = groupUrl(group.slug, 'settings')

    const ListItem = ({ title, url }) => (
      <TouchableOpacity
        onPress={() => navigation.navigate('Group Settings', { groupSlug: group?.slug })}
        className='w-full'
      >
        <View className='border-2 border-foreground/20 rounded-md p-2 mb-2 bg-background'>
          <Text className='text-base text-foreground'>{title}</Text>
        </View>
      </TouchableOpacity>
    )

    return (
      <View className='mb-2'>
        <TouchableOpacity
          onPress={() => navigation.navigate('Group Settings', { groupSlug: group?.slug })}
        >
          <View className='border-2 border-foreground/20 rounded-md p-2 mb-2 bg-background'>
            <Text className='text-base text-foreground'>{t('Settings')}</Text>
          </View>
        </TouchableOpacity>

        <View className='w-full'>
          {!group.avatarUrl && (
            <ListItem
              title={t('Add Avatar')}
              url={settingsUrl}
            />
          )}
          {!group.bannerUrl && (
            <ListItem
              title={t('Add Banner')}
              url={settingsUrl}
            />
          )}
          {!group.purpose && (
            <ListItem
              title={t('Add Purpose')}
              url={settingsUrl}
            />
          )}
          {(!group.description || group.description === 'This is a long-form description of the group') && (
            <ListItem
              title={t('Add Description')}
              url={settingsUrl}
            />
          )}
          {!group.locationObject && (
            <ListItem
              title={t('Add Location')}
              url={settingsUrl}
            />
          )}
        </View>
      </View>
    )
  }
}

function Header ({ group }) {
  const { t } = useTranslation()

  if (!group) return null

  return (
    <View className='w-full relative'>
      {!group.isContextGroup && (
        <GroupMenuHeader group={group} />
      )}
      {group.isContextGroup && (
        <View className='flex flex-col p-2'>
          <Text className='text-foreground font-bold text-lg'>
            {t(group.name)}
          </Text>
        </View>
      )}
    </View>
  )
}
