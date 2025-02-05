import React, { useMemo } from 'react'
import { View, Text, ScrollView, TouchableOpacity } from 'react-native'
import { useTranslation } from 'react-i18next'
import { capitalize } from 'lodash/fp'
import { widgetUrl as makeWidgetUrl } from 'util/navigation'
import { openURL } from 'hooks/useOpenURL'
import useCurrentGroup from '@hylo/hooks/useCurrentGroup'
import useHasResponsibility, { RESP_ADMINISTRATION } from '@hylo/hooks/useHasResponsibility'
import ContextWidgetPresenter from '@hylo/presenters/ContextWidgetPresenter'
import WidgetIconResolver from 'components/WidgetIconResolver'

function WidgetCard ({ widget, onPress }) {
  const { t } = useTranslation()

  if (!widget) return null

  return (
    <TouchableOpacity
      onPress={onPress}
      className='p-4 border border-foreground/20 rounded-md shadow-sm bg-background'
    >
      <View className='items-center'>
        <Text className='text-lg font-semibold text-foreground mb-2'>{widget.title}</Text>
        {widget.humanReadableType && (
          <Text className='text-sm text-foreground/70'>
            {t('Type')}: {t(capitalize(widget?.humanReadableType))}
          </Text>
        )}
        {widget.view && (
          <Text className='text-sm text-foreground/70'>
            {t('View')}: {t(capitalize(widget?.view))}
          </Text>
        )}
        <View className='mt-2'>
          <WidgetIconResolver widget={widget} size={24} />
        </View>
      </View>
    </TouchableOpacity>
  )
}

export default function AllViews () {
  const { t } = useTranslation()
  const [{ currentGroup }] = useCurrentGroup()
  const hasResponsibility = useHasResponsibility({ forCurrentGroup: true, forCurrentUser: true })
  const canAdminister = hasResponsibility(RESP_ADMINISTRATION)
  const contextWidgets = currentGroup?.contextWidgets || []
  const visibleWidgets = useMemo(() => {
    return contextWidgets.filter(widget => {
      if (widget.visibility === 'admin' && !canAdminister) return false
      if (widget.type === 'home') return false
      return true
    }).map(widget => ContextWidgetPresenter(widget, { t }))
  }, [contextWidgets, canAdminister])

  const handleWidgetPress = (widget) => {
    const widgetUrl = makeWidgetUrl({ widget, groupSlug: currentGroup?.slug })

    if (widgetUrl) {
      openURL(widgetUrl)
    } else {
      console.warn('Could not determine navigation for widget:', widget)
    }
  }

  return (
    <ScrollView className='flex-1 bg-background p-4'>
      <View className='grid grid-cols-2 gap-4'>
        {visibleWidgets.map(widget => (
          <WidgetCard
            key={widget.id}
            widget={widget}
            onPress={() => handleWidgetPress(widget)}
          />
        ))}
      </View>
    </ScrollView>
  )
}
