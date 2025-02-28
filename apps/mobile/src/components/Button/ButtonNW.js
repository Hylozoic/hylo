import React from 'react'
import { Text, View, TouchableOpacity } from 'react-native'
import Icon from 'components/Icon'

export default function ButtonNW ({
  className = '',
  containerClassName = '',
  textClassName = '',
  iconClassName = '',
  text,
  customIconRender,
  onPress,
  iconName,
  disabled
}) {
  // Default classes that can be overridden by provided classNames
  const defaultContainerClasses = 'items-center'
  const defaultButtonClasses = 'flex justify-center items-center border rounded-full h-[30px] bg-secondary'
  const defaultTextClasses = 'text-sm font-circular-bold text-foreground'
  const defaultIconClasses = 'text-base text-foreground pr-1.5'

  // Combine default classes with provided classes, handling disabled state
  const buttonClasses = `${defaultButtonClasses} ${
    disabled ? 'opacity-30' : ''
  } ${className}`
  
  const containerClasses = `${defaultContainerClasses} ${containerClassName}`
  const textClasses = `${defaultTextClasses} ${
    disabled ? 'opacity-60' : ''
  } ${textClassName}`
  const iconClasses = `${defaultIconClasses} ${
    disabled ? 'opacity-60' : ''
  } ${iconClassName}`

  return (
    <View className={containerClasses}>
      <TouchableOpacity 
        disabled={disabled} 
        onPress={disabled ? () => {} : onPress} 
        className="flex-row"
      >
        <View className={buttonClasses}>
          <View className="flex-1 flex-row items-center">
            {!!customIconRender && customIconRender({ 
              name: iconName, 
              className: iconClasses 
            })}
            {!customIconRender && !!iconName && (
              <Icon name={iconName} className={iconClasses} />
            )}
            <Text className={textClasses}>{text}</Text>
          </View>
        </View>
      </TouchableOpacity>
    </View>
  )
} 