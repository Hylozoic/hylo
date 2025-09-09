import React from 'react'
import { KeyboardAvoidingView } from 'react-native-keyboard-controller'
import { Platform } from 'react-native'

export default function KeyboardFriendlyView ({ children, ...props }) {
  const allProps = {
    ...props,
    behavior: Platform.OS === 'ios' ? 'padding' : 'height',
    enabled: true
  }
  return (
    <KeyboardAvoidingView {...allProps}>
      {children}
    </KeyboardAvoidingView>
  )
}
