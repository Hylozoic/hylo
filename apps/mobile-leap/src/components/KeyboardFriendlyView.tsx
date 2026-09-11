import { KeyboardAvoidingView, Platform, type KeyboardAvoidingViewProps } from 'react-native'

export default function KeyboardFriendlyView ({
  keyboardVerticalOffset = 0,
  style,
  children,
  ...props
}: KeyboardAvoidingViewProps) {
  return (
    <KeyboardAvoidingView
      style={[{ flex: 1 }, style]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={keyboardVerticalOffset}
      {...props}
    >
      {children}
    </KeyboardAvoidingView>
  )
}
