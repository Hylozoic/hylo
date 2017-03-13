import { findNodeHandle } from 'react-native'
import TextInputState from 'react-native/lib/TextInputState'

// via: http://stackoverflow.com/a/40837333/56817
export function focus (ref) {
  try {
    TextInputState.focusTextInput(findNodeHandle(ref))
  } catch (e) {
    console.log("Couldn't focus text input: ", e.message)
  }
}
