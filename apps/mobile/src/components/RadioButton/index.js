import React from 'react'
import { View, TouchableWithoutFeedback } from 'react-native'

export default function RadioButton ({
  onValueChange,
  size = 24,
  style = {},
  className = '',
  checked = false
}) {
  const handlePress = () => {
    onValueChange(!checked)
  }

  return (
    <TouchableWithoutFeedback onPress={handlePress}>
      <View
        className={`
          justify-center items-center rounded-full border-2
          ${checked ? 'border-selected' : 'border-foreground/50'}
          ${className}
        `}
        style={{
          width: size,
          height: size,
          ...style
        }}
      >
        {checked && (
          <View
            className='bg-selected rounded-full'
            style={{
              width: size * 0.5,
              height: size * 0.5
            }}
          />
        )}
      </View>
    </TouchableWithoutFeedback>
  )
} 