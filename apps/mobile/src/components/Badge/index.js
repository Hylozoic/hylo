import React from 'react'
import { View, Text } from 'react-native'
import styles from './Badge.styles'

export default function Badge ({ count, style }) {
  if (!count) return null
  return (
    <View style={[styles.badge, style]}>
      <Text style={styles.badgeText}>{count}</Text>
    </View>
  )
}
