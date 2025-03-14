import { Alert } from 'react-native'
import { useTranslation } from 'react-i18next'

export default function useConfirmAlert () {
  const { t } = useTranslation()
  const confirmAlert = ({
    onConfirm,
    hasChanges = true,
    title = 'You have unsaved changes',
    confirmMessage = 'Are you sure you want to discard your changes?',
    discardButtonText = 'Discard',
    continueButtonText = 'Continue Editing'
  }) => {
    if (hasChanges) {
      Alert.alert(
        t(title),
        t(confirmMessage),
        [
          { text: t(discardButtonText), onPress: onConfirm },
          { text: t(continueButtonText), style: 'cancel' }
        ])
    } else {
      onConfirm()
    }
  }

  return confirmAlert
}
