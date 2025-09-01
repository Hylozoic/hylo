/* eslint-disable react/no-unstable-nested-components */
import React from 'react'
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import { useTranslation } from 'react-i18next'
import { useCurrentGroup } from '@hylo/hooks/useCurrentGroup'
import Colors from '../../style/theme-colors'
import RNPickerSelect from 'react-native-picker-select'
import Icon from 'components/Icon'
import styles, { typeSelectorStyles } from './PostEditor.styles'

export default function TypeSelector (props) {
  const { t } = useTranslation()

  return (
    <View style={styles.typeSelectorWrapper}>
      <RNPickerSelect
        {...props}
        style={typeSelectorStyles(props.value)}
        useNativeAndroidPickerStyle={false}
        pickerProps={{ itemStyle: { backgroundColor: Colors.muted, letterSpacing: 2, fontWeight: 'bold', fontSize: 20 } }}
        items={
          ['Discussion', 'Request', 'Offer', 'Resource', 'Project', 'Event'].map(type => ({
            label: t(type).toUpperCase(),
            value: type.toLowerCase(),
            color: typeSelectorStyles(type.toLowerCase()).inputIOS.color
          }))
        }
        Icon={() => (
          <Icon name='ArrowDown' style={typeSelectorStyles(props.value).icon} />
        )}
      />
    </View>
  )
}
