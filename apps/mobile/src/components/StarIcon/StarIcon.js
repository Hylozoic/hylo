import React from 'react'
import { View } from 'react-native'
import {
  rhino80, linkWater
} from '@hylo/presenters/colors'
import Icon from 'components/Icon'

export default function StarIcon ({ style, theme = {} }) {
  return (
    <View style={[styles.wrapper, style, theme.wrapper]}>
      <View style={[styles.background, theme.background]} />
      <Icon name='Star' style={[styles.icon, theme.icon]} />
    </View>
  )
}

const styles = {
  starWrapper: {
    position: 'relative'
  },
  starBackground: {
    borderRadius: 100,
    width: 13,
    height: 13,
    backgroundColor: rhino80,
    position: 'absolute',
    top: 3,
    right: 4
  },
  starIcon: {
    color: linkWater,
    fontSize: 20,
    backgroundColor: 'transparent'
  }
}
