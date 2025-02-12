import React, { useMemo } from 'react'
import { View, Text, TouchableOpacity, ScrollView } from 'react-native'
import { useTranslation } from 'react-i18next'
import { useNavigation } from '@react-navigation/native'
import { PUBLIC_CONTEXT_SLUG, MY_CONTEXT_SLUG, ALL_GROUPS_CONTEXT_SLUG } from  '@hylo/shared'
import { widgetUrl as makeWidgetUrl } from 'util/navigation'
import FastImage from 'react-native-fast-image'
import useCurrentUser from '@hylo/hooks/useCurrentUser'
import useCurrentGroup, { useCurrentGroupSlug } from '@hylo/hooks/useCurrentGroup'
import useRouteParams from 'hooks/useRouteParams'
import ContextWidgetPresenter, { orderContextWidgetsForContextMenu } from '@hylo/presenters/ContextWidgetPresenter'
import useContextWidgetChildren from '@hylo/hooks/useContextWidgetChildren'
import useHasResponsibility, { RESP_ADD_MEMBERS, RESP_ADMINISTRATION } from '@hylo/hooks/useHasResponsibility'
import useLogout from 'hooks/useLogout'
import WidgetIconResolver from 'components/WidgetIconResolver'
import GroupMenuHeader from 'components/GroupMenuHeader'
import { openURL } from 'hooks/useOpenURL'
import { DEFAULT_APP_HOST } from 'navigation/linking'
import { URL } from 'react-native-url-polyfill'
import Loading from 'components/Loading'

export default function ContextMenu() {
  const { myHome, groupSlug } = useRouteParams()
  const [{ currentGroup, fetching }] = useCurrentGroup({ setToGroupSlug: groupSlug })
  const currentGroupSlug = useCurrentGroupSlug()
  const navigation = useNavigation()
  const { t } = useTranslation()
  const contextWidgets = currentGroup?.contextWidgets || []
  const orderedWidgets = useMemo(() => 
    orderContextWidgetsForContextMenu(contextWidgets.map( widget => ContextWidgetPresenter(widget, { t }))), [contextWidgets, currentGroup, myHome]
  )

  if (fetching && currentGroup) return <Loading />
  if (!currentGroup) return null

  const isPublic = currentGroup.slug === PUBLIC_CONTEXT_SLUG
  const isMyContext = currentGroup.slug === MY_CONTEXT_SLUG
  const isAllContext = currentGroup.slug === ALL_GROUPS_CONTEXT_SLUG

  return (
    <View className='flex-1 bg-background'>
      <ContextHeader 
        group={currentGroup}
      />
      <ContextWidgetList
        contextWidgets={orderedWidgets}
        groupSlug={currentGroup.slug}
        rootPath={`/groups/${currentGroup.slug}`}
      />
      {/* Add the All Views widget at the bottom, matching web behavior */}
      {(!isMyContext && !isPublic && !isAllContext) && (
        <View className='px-2 mb-2'>
          <TouchableOpacity 
            onPress={() => navigation.navigate('All Views')}
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

function ContextMenuItem({ widget, groupSlug, rootPath }) {
  const { t } = useTranslation()
  const { listItems, loading } = useContextWidgetChildren({ widget, groupSlug })
  const navigation = useNavigation()
  const logout = useLogout()
  const hasResponsibility = useHasResponsibility({ forCurrentGroup: true, forCurrentUser: true })
  const canAdmin = hasResponsibility(RESP_ADMINISTRATION)
  const [{ currentGroup, isContextGroupSlug }] = useCurrentGroup()
  
  const title = widget.title
  const url = makeWidgetUrl({ widget, rootPath, groupSlug })

  const handleWidgetPress = widget => {
    const context = isContextGroupSlug ? currentGroup?.slug : 'groups'
    const linkingPath = makeWidgetUrl({ widget, rootPath, groupSlug: isContextGroupSlug ? null : currentGroup?.slug })

    openURL(linkingPath)
  }
  if (widget.isHiddenInContextMenu) return null
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
      { widget.view && (
        <TouchableOpacity 
          onPress={() => handleWidgetPress(widget)}
          className='flex-row justify-between items-center content-center'
        >
          <Text className='text-sm font-semibold text-foreground'>{title}</Text>
        </TouchableOpacity>
      )}
      { !widget.view && (
        <View className='flex-row justify-between items-center content-center'>
          <Text className='text-sm font-semibold text-foreground'>{title}</Text>
        </View>
      )}
      <View className='flex flex-col justify-center items-center relative'>
        {/* Need to add the SpecialTopElementRenderer here */}
      </View>
      {loading && <Text>{t('Loading...')}</Text>}
      {listItems.length > 0 && listItems.map(item => <ListItemRenderer key={item.id} item={item} rootPath={rootPath} groupSlug={groupSlug} handleWidgetPress={handleWidgetPress} />)}
    </View>
  )
}

function ListItemRenderer({ item, rootPath, groupSlug, handleWidgetPress }) {
  const { t } = useTranslation()
  const itemTitle = item.title
  const itemUrl = makeWidgetUrl({ widget: item, rootPath, groupSlug, context: 'group' })

  return (
    <TouchableOpacity 
      key={item.id + itemTitle}
      onPress={() => handleWidgetPress(item)}
      className='flex-row items-center ml-8 h-12 py-2 gap-2 content-center border-b border-foreground/20'
    >
      <View className='w-5'><WidgetIconResolver widget={item} className='mr-2' /></View>
      <Text className='text-sm text-primary-accent'>{itemTitle}</Text>
    </TouchableOpacity>
  )
}

function SpecialTopElementRenderer({ widget, group }) {
  const { t } = useTranslation()
  const navigation = useNavigation()
  const hasResponsibility = useHasResponsibility({ forCurrentGroup: true, forCurrentUser: true })
  const canAddMembers = hasResponsibility(RESP_ADD_MEMBERS)

  if (widget.type === 'members' && canAddMembers) {
    return (
      <TouchableOpacity 
        onPress={() => navigation.navigate('Group Settings', { screen: 'Invite' })}
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
}

function ContextWidgetList({ contextWidgets, groupSlug, rootPath }) {
  return (
    <ScrollView className='p-2'>
      {contextWidgets.map(widget => (
        <View key={widget.id} className='mb-1'>
          <ContextMenuItem 
            widget={widget} 
            groupSlug={groupSlug} 
            rootPath={rootPath}
          />
        </View>
      ))}
    </ScrollView>
  )
}

function ContextHeader({ group }) {
  const { t } = useTranslation()

  const isPublic = group?.slug === PUBLIC_CONTEXT_SLUG
  const isMyContext = group?.slug === MY_CONTEXT_SLUG
  const isAllContext = group?.slug === ALL_GROUPS_CONTEXT_SLUG
  const isGroupContext = !isAllContext && !isMyContext && !isPublic
  return null
  // return (
    // <View className='w-full relative'>
    //   {isGroupContext ? (
    //     <GroupMenuHeader group={group} />
    //   ) : isPublic ? (
    //     <View className='flex flex-col p-2'>
    //       <Text className='text-foreground font-bold text-lg'>{t('The Commons')}</Text>
    //     </View>
    //   ) : (isMyContext || isAllContext) ? (
    //     <View className='flex flex-col p-2'>
    //       <Text className='text-foreground font-bold text-lg'>{t('My Home')}</Text>
    //     </View>
    //   ) : null}
    // </View>
  // )
}
