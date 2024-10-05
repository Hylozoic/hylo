import React from 'react'
import { View, TouchableOpacity } from 'react-native'
import Icon from 'components/Icon'
import styles from './BadgedIcon.styles'

export default function BadgedIcon (props) {
  return (
    <TouchableOpacity onPress={props.action}>
      <Icon {...props} />
      {props.showBadge && <View style={styles.badgeOuter}>
        <View style={styles.badgeInner} />
      </View>}
    </TouchableOpacity>
  )
}
