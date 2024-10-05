import { isIOS } from './platform'

export const keyboardAvoidingViewProps = {
  behavior: 'padding',
  keyboardVerticalOffset: isIOS ? 64 : 80
}
