import React, { useEffect, useRef } from 'react'
import { Animated, View, TouchableWithoutFeedback } from 'react-native'
import Icon from 'react-native-vector-icons/Ionicons'
import { caribbeanGreen, rhino50 } from 'style/colors'

const RoundCheckbox = ({
  onValueChange,
  icon = 'checkmark-outline',
  size = 24,
  checkedColor = caribbeanGreen,
  uncheckedColor = rhino50,
  iconColor = 'white',
  checked = false,
  style = {}
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

  const containerStyle = {
    width: size,
    height: size,
    borderRadius: size / 2,
    borderWidth: 1,
    borderColor: checked ? checkedColor : uncheckedColor,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: checked ? checkedColor : 'transparent'
  }

  return (
    <TouchableWithoutFeedback onPress={handlePress}>
      <View style={[containerStyle, style]}>
        {checked && (
          <Animated.View
            style={{
              transform: [{ scale: scaleAndOpacity }],
              opacity: scaleAndOpacity,
              justifyContent: 'center',
              alignItems: 'center'
            }}
          >
            <Icon
              name={icon}
              size={size * 0.8}
              color={iconColor}
            />
          </Animated.View>
        )}
      </View>
    </TouchableWithoutFeedback>
  )
}

export default RoundCheckbox
