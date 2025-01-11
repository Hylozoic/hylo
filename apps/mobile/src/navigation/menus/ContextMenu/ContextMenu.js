import React, { useMemo } from 'react'
import { View, Text, TouchableOpacity, ScrollView } from 'react-native'
import { useTranslation } from 'react-i18next'
import { useNavigation, useLinkTo } from '@react-navigation/native'
import FastImage from 'react-native-fast-image'
import WidgetIconResolver from 'components/WidgetIconResolver'
import useCurrentUser from 'hooks/useCurrentUser'
import useCurrentGroup, { useCurrentGroupSlug } from 'hooks/useCurrentGroup'
import useRouteParams from 'hooks/useRouteParams'
import useHasResponsibility from 'hooks/useHasResponsibility'
import { RESP_ADD_MEMBERS } from 'store/constants'
import { WidgetHelpers, NavigatorHelpers } from  '@hylo/shared'
import getContextWidgetsForGroup from 'store/selectors/getContextWidgetsForGroup'

const { widgetTitleResolver, getStaticMenuWidgets, orderContextWidgetsForContextMenu } = WidgetHelpers
const { widgetUrl } = NavigatorHelpers

function ContextMenuItem({ widget, groupSlug, rootPath }) {
  const { t } = useTranslation()
  const linkTo = useLinkTo()
  const navigation = useNavigation()
  const title = widgetTitleResolver({ widget, t })
  const url = widgetUrl({ widget, rootPath, groupSlug })

  const handlePress = () => {
    if (url) {
      linkTo(url)
      // navigation.navigate('Stream')
    }
  }

  return (
    <TouchableOpacity 
      onPress={handlePress}
      className="flex-row items-center p-3 bg-background rounded-md mb-2 gap-2"
    >
      <WidgetIconResolver widget={widget} className="mr-2" />
      <Text className="text-sm font-bold text-foreground">{title}</Text>
    </TouchableOpacity>
  )
}

function ListItemRenderer({ item, rootPath, groupSlug }) {
  const { t } = useTranslation()
  const linkTo = useLinkTo()
  const itemTitle = widgetTitleResolver({ widget: item, t })
  const itemUrl = widgetUrl({ widget: item, rootPath, groupSlug, context: 'group' })

  const handlePress = () => {
    if (itemUrl) {
      linkTo(itemUrl)
    }
  }

  return (
    <TouchableOpacity 
      onPress={handlePress}
      className="flex-row items-center py-2 gap-4"
    >
      <WidgetIconResolver widget={item} className="mr-2" />
      <Text className="text-sm text-primary">{itemTitle}</Text>
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
        className="px-4 py-2 bg-primary rounded-md"
      >
        <Text className="text-sm font-medium text-white">{t('Add Members')}</Text>
      </TouchableOpacity>
    )
  }

  if (widget.type === 'about') {
    return (
      <View className="mb-4">
        <Text className="text-sm text-gray-600 mb-2">{group.purpose}</Text>
        <Text className="text-sm text-gray-600">{group.description}</Text>
      </View>
    )
  }

  return null
}

function ContextWidgetList({ contextWidgets, groupSlug, rootPath }) {
  return (
    <ScrollView className="p-2">
      {contextWidgets.map(widget => (
        <View key={widget.id} className="mb-2">
          <ContextMenuItem 
            widget={widget} 
            groupSlug={groupSlug} 
            rootPath={rootPath}
          />
          {/* {widget.childWidgets?.length > 0 && (
            <View className="ml-4">
              {widget.childWidgets.map(item => (
                <ListItemRenderer
                  key={item.id}
                  item={item}
                  rootPath={rootPath}
                  groupSlug={groupSlug}
                />
              ))}
            </View>
          )} */}
        </View>
      ))}
    </ScrollView>
  )
}

export default function ContextMenu() {
  const [currentGroup] = useCurrentGroup()
  const currentGroupSlug = useCurrentGroupSlug()
  const { myHome } = useRouteParams()
  const contextWidgets = getContextWidgetsForGroup(currentGroup)
  const orderedWidgets = useMemo(() => orderContextWidgetsForContextMenu(contextWidgets), [contextWidgets, currentGroup, myHome])
  console.log(currentGroupSlug, 'currentGroupSlugsssss')
  if (!currentGroup || myHome) return null

  return (
    <View className="flex-1 bg-background">
      <ContextWidgetList
        contextWidgets={orderedWidgets}
        groupSlug={currentGroup.slug}
        rootPath={`/groups/${currentGroup.slug}`}
      />
    </View>
  )
}
