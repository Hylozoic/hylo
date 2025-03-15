import React, { useMemo } from 'react'
import { View, Text, ScrollView, TouchableOpacity } from 'react-native'
import { useTranslation } from 'react-i18next'
import { flow, filter, map, sortBy } from 'lodash/fp'
import { translateTitle } from '@hylo/presenters/ContextWidgetPresenter'
import useCurrentUser from '@hylo/hooks/useCurrentUser'
import useCurrentGroup from '@hylo/hooks/useCurrentGroup'
import useHasResponsibility, { RESP_ADMINISTRATION } from '@hylo/hooks/useHasResponsibility'
import { widgetUrl } from 'util/navigation'
import { openURL } from 'hooks/useOpenURL'
import WidgetIconResolver from 'components/WidgetIconResolver'

export default function AllViews () {
  const { t } = useTranslation()
  const [{ currentUser }] = useCurrentUser()
  const [{ currentGroup }] = useCurrentGroup()
  const hasResponsibility = useHasResponsibility({ forCurrentGroup: true, forCurrentUser: true })
  const canAdminister = hasResponsibility(RESP_ADMINISTRATION)
  const widgets = currentGroup?.getContextWidgets(currentUser) || []
  const visibleWidgets = useMemo(() => {
    return flow(

      filter(widget =>
        !(widget.visibility === 'admin' && !canAdminister) &&
        widget.visibility !== 'none' &&
        widget.type !== 'home'
      ),

      map(widget => ({
        ...widget,
        title: translateTitle(widget.title, t)
      })),

      sortBy('title')

    )(widgets)
  }, [widgets, canAdminister, t])

  const handleWidgetPress = widget => {
    widget?.customView?.externalLink
      ? openURL(widget.customView.externalLink)
      : openURL(widgetUrl({ widget, groupSlug: currentGroup?.slug }))
  }

  return (
    <ScrollView className='bg-background p-4' contentContainerClassName='gap-4'>
      {visibleWidgets.map((widget, index) => (
        <TouchableOpacity
          key={index}
          onPress={() => handleWidgetPress(widget)}
          className='p-4 border border-foreground/20 rounded-md shadow-sm bg-background'
        >
          <View className='items-center'>
            <View className='flex-row items-center content-center'>
              <WidgetIconResolver widget={widget} style={{ fontSize: 18, marginRight: 10 }} />
              <Text className='text-xl font-semibold text-foreground'>{widget.title}</Text>
            </View>
          </View>
        </TouchableOpacity>
      ))}
    </ScrollView>
  )
}
