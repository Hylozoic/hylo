import React from 'react'
import { TouchableOpacity } from 'react-native'
import { useLinkProps } from '@react-navigation/native'

export default function LinkButton ({
  to,
  action,
  children,
  ...rest
}) {
  const { onPress, ...props } = useLinkProps({ to, action })

  return (
    <TouchableOpacity onPress={onPress} {...props} {...rest}>
      {children}
    </TouchableOpacity>
  )
}
