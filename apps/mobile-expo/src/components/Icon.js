import React from 'react'
import { Text } from 'react-native'

// Import vector icons
import EntypoIcon from 'react-native-vector-icons/Entypo'
import MaterialIcon from 'react-native-vector-icons/MaterialIcons'

export default function Icon ({ name, style, className }) {
  // Map icon names to proper vector icons
  switch (name) {
    case 'Google':
      return <MaterialIcon name="google" style={style} className={className} />
    case 'check':
      return <EntypoIcon name="check" style={style} className={className} />
    case 'eye':
      return <EntypoIcon name="eye" style={style} className={className} />
    case 'eye-with-line':
      return <EntypoIcon name="eye-with-line" style={style} className={className} />
    default:
      return <Text style={style} className={className}>•</Text>
  }
}