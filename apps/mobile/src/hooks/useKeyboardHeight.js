import { useEffect, useState } from 'react'
import { Keyboard } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { isIOS } from 'util/platform'

/**
 * Custom hook to handle keyboard height adjustments for WebView and complex layouts
 * where react-native-keyboard-controller's KeyboardAvoidingView doesn't work properly
 * 
 * @param {Object} options - Configuration options
 * @param {number} options.iosOffset - Additional offset for iOS (default: 60)
 * @param {number} options.androidOffset - Additional offset for Android (default: 0) 
 * @returns {number} keyboardHeight - The adjusted keyboard height to use as marginBottom
 */
export function useKeyboardHeight({ iosOffset = 60, androidOffset = 0 } = {}) {
  const [keyboardHeight, setKeyboardHeight] = useState(0)
  const safeAreaInsets = useSafeAreaInsets()

  useEffect(() => {
    const keyboardDidShowListener = Keyboard.addListener(
      'keyboardDidShow',
      (event) => {
        // Apply platform-specific adjustments
        const adjustedHeight = isIOS 
          ? Math.max(0, event.endCoordinates.height - safeAreaInsets.bottom - iosOffset)
          : event.endCoordinates.height - androidOffset
        setKeyboardHeight(adjustedHeight)
      }
    )
    const keyboardDidHideListener = Keyboard.addListener(
      'keyboardDidHide',
      () => {
        setKeyboardHeight(0)
      }
    )

    return () => {
      keyboardDidShowListener.remove()
      keyboardDidHideListener.remove()
    }
  }, [safeAreaInsets.bottom, iosOffset, androidOffset])

  return keyboardHeight
}

export default useKeyboardHeight
