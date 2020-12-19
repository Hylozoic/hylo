import React from 'react'
import config from './config.json'
import { createIconSet } from 'react-native-vector-icons'
import * as colors from 'style/colors'

const glyphMap = config.icons.reduce((m, { icon: { tags, defaultCode } }) => {
  m[tags[0]] = defaultCode
  return m
}, {})

const RawIcon = createIconSet(glyphMap, 'hylo-evo-icons')

function Icon ({ color, ...otherProps }) {
  if (color && !color.startsWith('#')) {
    color = colors[color]
    if (!color) {
      throw new Error(`unrecognized color name: "${color}"`)
    }
  }
  return <RawIcon {...{ color, ...otherProps }} />
}

Icon.TabBarItemIOS = RawIcon.TabBarItemIOS

export default Icon
