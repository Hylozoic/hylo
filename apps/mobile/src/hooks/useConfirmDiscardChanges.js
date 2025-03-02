import { Alert } from 'react-native'
import { useTranslation } from 'react-i18next'

export default function useConfirmDiscardChanges () {
  const { t } = useTranslation()
  const confirmDiscardChanges = ({
    onDiscard,
    hasChanges = true,
    title = 'You have unsaved changes',
    confirmationMessage = 'Are you sure you want to discard your changes?',
    discardButtonText = 'Discard',
    continueButtonText = 'Continue Editing'
  }) => {
    if (hasChanges) {
      Alert.alert(
        t(title),
        t(confirmationMessage),
        [
          { text: t(discardButtonText), onPress: onDiscard },
          { text: t(continueButtonText), style: 'cancel' }
        ])
    } else {
      onDiscard()
    }
  }

  return confirmDiscardChanges
}
