import React, { useCallback, useState } from 'react'
import { useSelector, useDispatch } from 'react-redux'
import { useFocusEffect } from '@react-navigation/native'
import { Text, View, ScrollView, TouchableOpacity } from 'react-native'
import RoundCheckbox from 'components/RoundCheckBox'
import Icon from 'components/Icon'
import {
  GROUP_ACCESSIBILITY, GROUP_VISIBILITY,
  visibilityDescription, accessibilityDescription,
  visibilityIcon, accessibilityIcon
} from '@hylo/presenters/GroupPresenter'
import { caribbeanGreen, white20onCaribbeanGreen, white } from 'style/colors'
import { getGroupData, updateGroupData } from './CreateGroupFlow.store'
import styles from './CreateGroupFlow.styles'
import KeyboardFriendlyView from 'components/KeyboardFriendlyView'
import { useTranslation } from 'react-i18next'

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
    <KeyboardFriendlyView className="bg-background p-5 flex-1">
      <ScrollView style={{ margins: 0 }}>
        <View>
          <View className="mb-6">
            <Text className="text-foreground text-xl font-bold mb-2.5">{t('Who can see this group')}</Text>
            {groupVisibilityOptions.map(option => (
              <Option
                option={option} 
                chosen={option.value === visibility}
                onPress={setVisibility} 
                key={option.value}
              />
            ))}
          </View>
          <View className="mb-6">
            <Text className="text-foreground text-xl font-bold mb-2.5">{t('Who can join this group')}</Text>
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
    <TouchableOpacity className="p-4 pb-0 mb-2.5 flex-row justify-start" onPress={() => onPress(option.value)}>
      <RoundCheckbox
        className="mt-2.5"
        size={24}
        checked={chosen}
        onValueChange={() => onPress(option.value)}
      />
      <Icon className="ml-2.5 text-xl text-foreground" name={option.iconName} />
      <Text className="mt-[-4] ml-2.5 font-circular-bold flex-1 text-base text-foreground">
        {option.label}
      </Text>
    </TouchableOpacity>
  )
}

const stepStyles = {
  optionsContainer: {
    marginBottom: 24
  },
  optionsLabel: {
    fontSize: 20,
    color: white,
    fontWeight: 'bold',
    marginBottom: 10
  },
}

const optionStyles = {
  optionRow: {
    padding: 15,
    paddingBottom: 0,
    marginBottom: 10,
    flexDirection: 'row',
    justifyContent: 'flex-start'
  },
  optionCheckbox: {
    marginTop: 10,
    color: caribbeanGreen
  },
  optionIcon: {
    marginLeft: 10,
    fontSize: 20,
    color: white
  },
  optionsLabel: {
    marginTop: -4,
    marginLeft: 10,
    fontFamily: 'Circular-Bold',
    flex: 1,
    fontSize: 16,
    color: white
  }
}
