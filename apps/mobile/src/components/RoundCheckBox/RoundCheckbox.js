import React, { useEffect, useRef } from 'react'
import { Animated, View, TouchableWithoutFeedback } from 'react-native'
import Icon from 'react-native-vector-icons/Ionicons'

const RoundCheckbox = ({
  onValueChange,
  icon = 'checkmark-outline',
  size = 24,
  style = {},
  className = '',
  checked = false
}) => {
  const scaleAndOpacity = useRef(new Animated.Value(checked ? 1 : 0)).current

  useEffect(() => {
    Animated.timing(scaleAndOpacity, {
      toValue: checked ? 1 : 0,
      duration: 80,
      useNativeDriver: true
    }).start()
  }, [checked])

  const handlePress = () => {
    onValueChange(!checked)
  }

  return (
    <TouchableWithoutFeedback onPress={handlePress}>
      <View 
        className={`
          justify-center items-center rounded-full border
          ${checked ? 'bg-secondary border-background' : 'border-foreground/50'}
          ${className}
        `}
        style={{
          width: size,
          height: size,
          ...style
        }}
      >
        {checked && (
          <Animated.View
            style={{
              transform: [{ scale: scaleAndOpacity }],
              opacity: scaleAndOpacity,
              justifyContent: 'center',
              alignItems: 'center',
              ...style
            }}
          >
            <Icon
              name={icon}
              size={size * 0.8}
              color='hsl(var(--background))'
            />
          </Animated.View>
        )}
      </View>
    </TouchableWithoutFeedback>
  )
}

export default RoundCheckbox
