import React, { useCallback, useState } from 'react'
import { useSelector, useDispatch } from 'react-redux'
import { useFocusEffect } from '@react-navigation/native'
import { Text, View, ScrollView, TouchableOpacity } from 'react-native'
import { useTranslation } from 'react-i18next'
import {
  GROUP_ACCESSIBILITY, GROUP_VISIBILITY,
  visibilityDescription, accessibilityDescription,
  visibilityIcon, accessibilityIcon
} from '@hylo/presenters/GroupPresenter'
import { getGroupData, updateGroupData } from './CreateGroupFlow.store'
import KeyboardFriendlyView from 'components/KeyboardFriendlyView'
import RoundCheckbox from 'components/RoundCheckBox'
import Icon from 'components/Icon'

const groupVisibilityOptions = Object.keys(GROUP_VISIBILITY).map(label => ({
  label: label + ': ' + visibilityDescription(GROUP_VISIBILITY[label]),
  iconName: visibilityIcon(GROUP_VISIBILITY[label]),
  value: GROUP_VISIBILITY[label]
}))

const groupAccessibilityOptions = Object.keys(GROUP_ACCESSIBILITY).map(label => ({
  label: label + ': ' + accessibilityDescription(GROUP_ACCESSIBILITY[label]),
  iconName: accessibilityIcon(GROUP_ACCESSIBILITY[label]),
  value: GROUP_ACCESSIBILITY[label]
}))

export default function CreateGroupVisibilityAccessibility ({ navigation }) {
  const { t } = useTranslation()
  const dispatch = useDispatch()
  const groupData = useSelector(getGroupData)
  const [visibility, setVisibility] = useState(groupData.visibility)
  const [accessibility, setAccessibility] = useState(groupData.accessibility)

  useFocusEffect(useCallback(() => {
    dispatch(updateGroupData({ visibility, accessibility }))
  }, [visibility, accessibility]))

  return (
    <KeyboardFriendlyView className='bg-background p-5 flex-1'>
      <ScrollView>
        <View>
          <View className='mb-6'>
            <Text className='text-foreground text-xl font-bold mb-2.5'>{t('Who can see this group?')}</Text>
            {groupVisibilityOptions.map(option => (
              <Option
                option={option}
                chosen={option.value === visibility}
                onPress={setVisibility}
                key={option.value}
              />
            ))}
          </View>
          <View className='mb-6'>
            <Text className='text-foreground text-xl font-bold mb-2.5'>{t('Who can join this group?')}</Text>
            {groupAccessibilityOptions.map(option => (
              <Option
                option={option}
                chosen={option.value === accessibility}
                onPress={setAccessibility}
                key={option.value}
              />
            ))}
          </View>
        </View>
      </ScrollView>
    </KeyboardFriendlyView>
  )
}

export function Option ({ option, chosen, onPress }) {
  return (
    <TouchableOpacity className='p-4 pb-0 mb-2.5 flex-row items-center' onPress={() => onPress(option.value)}>
      <RoundCheckbox className='mr-3' size={24} checked={chosen} onValueChange={() => onPress(option.value)} />
      <Icon className='mr-3 self-center' size={22} name={option.iconName} />
      <Text className='mt-[-4] ml-2.5 font-circular-bold flex-1 self-center'>
        {option.label}
      </Text>
    </TouchableOpacity>
  )
}
