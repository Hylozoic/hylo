import React from 'react'
import { KeyboardAvoidingView } from 'react-native-keyboard-controller'
import { Platform } from 'react-native'

export default function KeyboardFriendlyView ({ children, keyboardVerticalOffset, ...props }) {
  const allProps = {
    ...props,
    behavior: Platform.OS === 'ios' ? 'padding' : 'height',
    keyboardVerticalOffset: keyboardVerticalOffset || 0,
    enabled: true
  }
  return (
    <KeyboardAvoidingView {...allProps}>
      {children}
    </KeyboardAvoidingView>
  )
}
