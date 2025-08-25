import React from 'react'
import { View } from 'react-native'
import {
  linkWater
} from '@hylo/presenters/colors'
import Icon from 'components/Icon'
import Colors from '../../style/theme-colors'

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
    backgroundColor: Colors.foreground80,
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
