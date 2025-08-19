import React from 'react'
import { TouchableOpacity, StyleSheet } from 'react-native'
import Colors from '../../style/theme-colors'
import Icon from 'components/Icon'

export default function HeaderLeftCloseIcon ({
  onPress,
  color = Colors.muted,
  disabled,
  style
}) {
  if (typeof onPress !== 'function') throw new Error('LeftHeaderClose: onPress is not a function.')

  return (
    <TouchableOpacity
      onPress={onPress}
      hitSlop={{ top: 7, bottom: 7, left: 7, right: 7 }}
      disabled={disabled}
    >
      <Icon name='Ex' style={[styles.exIcon, style]} color={color} />
    </TouchableOpacity>
  )
}

const styles = StyleSheet.create({
  exIcon: {
    marginRight: 12,
    fontSize: 20,
    padding: 7
  }
})
