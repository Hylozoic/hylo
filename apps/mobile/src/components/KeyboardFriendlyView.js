import React from 'react'
import { KeyboardAvoidingView } from 'react-native'
import { isIOS } from 'util/platform'

export default function KeyboardFriendlyView ({ children, ...props }) {
  const allProps = {
    ...props,
    behavior: isIOS ? 'padding' : '',
    keyboardVerticalOffset: isIOS ? 94 : 64,
    enabled: true
  }
  return (
    <KeyboardAvoidingView {...allProps}>
      {children}
    </KeyboardAvoidingView>
  )
}
