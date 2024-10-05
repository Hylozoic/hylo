import React, {useState} from 'react'
import * as ReactNative from 'react-native'

export const Switch = props => {
  const [value, setValue] = useState(props.value)
  return (
    <ReactNative.TouchableOpacity
      onPress={() => {
        props.onValueChange(!value)
        setValue(!value)
      }}
      testID={props.testID}>
      <ReactNative.Text>{value?.toString()}</ReactNative.Text>
    </ReactNative.TouchableOpacity>
  )
}

newRN = Object.defineProperty(ReactNative, 'Switch', {
  get: function() {
    return Switch
  }
})

module.exports = newRN
