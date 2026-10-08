import React from 'react'
import config from './config.json'
import { createIconSet } from 'react-native-vector-icons'
import * as colors from '@hylo/presenters/colors'

const glyphMap = config.icons.reduce((m, { properties: { code, name } }) => {
  m[name] = code
  return m
}, {})

const RawIcon = createIconSet(glyphMap, 'hylo-evo-icons')

function Icon ({ name: providedName, color, ...otherProps }) {
  const name = providedName === 'Request' ? 'Heart' : providedName

  if (color && !color.startsWith('#')) {
    color = colors[color]
    if (!color) {
      throw new Error(`unrecognized color name: "${color}"`)
    }
  }

  return <RawIcon {...otherProps} color={color} name={name} />
}

export default Icon
