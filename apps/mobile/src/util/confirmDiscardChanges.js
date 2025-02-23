import { Alert } from 'react-native'

export default function confirmDiscardChanges ({
  onDiscard,
  hasChanges = true,
  title = 'You have unsaved changes',
  confirmationMessage = 'Are you sure you want to discard your changes?',
  disgardButtonText = 'Discard',
  continueButtonText = 'Continue Editing',
  t
}) {
  t('You have unsaved changes')
  t('Are you sure you want to discard your changes?')
  t('Discard')
  t('Continue Editing')
  if (hasChanges) {
    Alert.alert(
      t(title),
      t(confirmationMessage),
      [
        { text: t(disgardButtonText), onPress: onDiscard },
        { text: t(continueButtonText), style: 'cancel' }
      ])
  } else {
    onDiscard()
  }
}
