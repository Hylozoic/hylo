import React from 'react'
import { Text, TouchableOpacity } from 'react-native'
import useOpenURL from '../hooks/useOpenURL'

export default function LinkButton ({
  to,
  action,
  children,
  ...rest
}) {
  const openURL = useOpenURL()
  
  const handlePress = () => {
    if (to) {
      openURL(to)
    }
    if (action) {
      action()
    }
  }

  return (
    <TouchableOpacity onPress={handlePress} {...rest}>
      <Text style={{ textDecorationLine: 'underline' }}>{children}</Text>
    </TouchableOpacity>
  )
}