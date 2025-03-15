import React, { useCallback } from 'react'
import { useFocusEffect } from '@react-navigation/native'
import { Text, View, ScrollView, TouchableOpacity } from 'react-native'
import { useTranslation } from 'react-i18next'
import {
  GROUP_ACCESSIBILITY, GROUP_VISIBILITY,
  visibilityDescription, accessibilityDescription,
  visibilityIcon, accessibilityIcon
} from '@hylo/presenters/GroupPresenter'
import { useCreateGroupStore } from './CreateGroup.store'
import RoundCheckbox from 'components/RoundCheckBox'
import Icon from 'components/Icon'

const groupVisibilityOptions = Object.keys(GROUP_VISIBILITY).map(label => ({
  label: label + ': ' + visibilityDescription(GROUP_VISIBILITY[label]),
  iconName: visibilityIcon(GROUP_VISIBILITY[label]),
  value: GROUP_VISIBILITY[label]
}))

export const DEFAULT_VISIBILITY_OPTION = groupVisibilityOptions.find(visibility => visibility.value === GROUP_VISIBILITY.Protected)

const groupAccessibilityOptions = Object.keys(GROUP_ACCESSIBILITY).map(label => ({
  label: label + ': ' + accessibilityDescription(GROUP_ACCESSIBILITY[label]),
  iconName: accessibilityIcon(GROUP_ACCESSIBILITY[label]),
  value: GROUP_ACCESSIBILITY[label]
}))

export const DEFAULT_ACCESSIBILITY_OPTION = groupAccessibilityOptions.find(accessibility => accessibility.value === GROUP_ACCESSIBILITY.Restricted)

export default function CreateGroupVisibilityAccessibility ({ navigation }) {
  const { t } = useTranslation()
  const { groupData, updateGroupData } = useCreateGroupStore()
  const visibility = groupData.visibility
  const setVisibility = newVisibility => updateGroupData({ visibility: newVisibility })
  const accessibility = groupData.accessibility
  const setAccessibility = newAccessibility => updateGroupData({ accessibility: newAccessibility })

  useFocusEffect(useCallback(() => {
    updateGroupData({ visibility, accessibility })
  }, [visibility, accessibility]))

  return (
    <>
      <View>
        <View className='mb-6'>
          <Text className='text-foreground text-xl font-bold mb-2.5'>{t('Who can see this group?')}</Text>
          {groupVisibilityOptions.map(option => (
            <GroupPrivacyOption
              option={option}
              chosen={option.value === visibility.value}
              onPress={setVisibility}
              key={option.value}
            />
          ))}
        </View>
        <View className='mb-6'>
          <Text className='text-foreground text-xl font-bold mb-2.5'>{t('Who can join this group?')}</Text>
          {groupAccessibilityOptions.map(option => (
            <GroupPrivacyOption
              option={option}
              chosen={option.value === accessibility.value}
              onPress={setAccessibility}
              key={option.value}
            />
          ))}
        </View>
      </View>
    </>
  )
}

export function GroupPrivacyOption ({ option, chosen, onPress }) {
  if (!option) return
  return (
    <TouchableOpacity className='flex-row items-center p-4 pb-0 mb-2.5' onPress={() => onPress && onPress(option)}>
      {onPress && (
        <RoundCheckbox className='mr-3' size={24} checked={chosen} onValueChange={() => onPress(option)} />
      )}
      <Icon className='mr-3 self-center' size={22} name={option.iconName} />
      <Text className='mt-[-4] ml-2.5 font-circular-bold flex-1 self-center font-bold'>
        {option.label}
      </Text>
    </TouchableOpacity>
  )
}
