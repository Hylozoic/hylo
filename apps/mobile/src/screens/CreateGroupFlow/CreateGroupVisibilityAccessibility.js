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
} from 'presenters/GroupPresenter'
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
    <KeyboardFriendlyView style={styles.container}>
      <ScrollView style={{ margins: 0 }}>
        <View style={styles.content}>
          <View style={stepStyles.optionsContainer}>
            <Text style={stepStyles.optionsLabel}>{t('Who can see this group')}</Text>
            {groupVisibilityOptions.map(option => (
              <Option
                option={option} chosen={option.value === visibility}
                onPress={setVisibility} key={option.value}
              />
            ))}
          </View>
          <View style={styles.optionsContainer}>
            <Text style={stepStyles.optionsLabel}>{t('Who can join this group')}</Text>
            {groupAccessibilityOptions.map(option => (
              <Option
                option={option} chosen={option.value === accessibility}
                onPress={setAccessibility} key={option.value}
              />
            ))}
          </View>
        </View>
      </ScrollView>
    </KeyboardFriendlyView>
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

export function Option ({ option, chosen, onPress }) {
  return (
    <TouchableOpacity style={optionStyles.optionRow} onPress={() => onPress(option.value)}>
      <RoundCheckbox
        style={optionStyles.optionCheckbox}
        size={24}
        // icon={'checkmark-outline'}
        checked={chosen}
        iconColor={white20onCaribbeanGreen}
        borderColor={white}
        backgroundColor={white}
        onValueChange={() => onPress(option.value)}
      />
      <Icon style={optionStyles.optionIcon} name={option.iconName} />
      <Text style={optionStyles.optionsLabel}>{option.label}</Text>
    </TouchableOpacity>
  )
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
