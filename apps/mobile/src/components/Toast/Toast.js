import React, { useEffect, useRef } from 'react'
import { Animated, Text, View, TouchableOpacity } from 'react-native'
import { Check, AlertCircle, X } from 'lucide-react-native'

const TOAST_TIMEOUT = 4000

export default function Toast ({ text1, text2, type = 'default', onHide, duration = TOAST_TIMEOUT }) {
  const fadeAnim = useRef(new Animated.Value(0)).current
  const slideAnim = useRef(new Animated.Value(100)).current

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true
      })
    ]).start()

    const timer = setTimeout(() => {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true
        }),
        Animated.timing(slideAnim, {
          toValue: 100,
          duration: 300,
          useNativeDriver: true
        })
      ]).start(() => onHide())
    }, duration)

    return () => clearTimeout(timer)
  }, [])

  const getIcon = () => {
    switch (type) {
      case 'success':
        return <Check className='text-success' size={24} />
      case 'error':
        return <AlertCircle className='text-destructive' size={24} />
      default:
        return null
    }
  }

  const getBackgroundColor = () => {
    switch (type) {
      case 'success':
        return 'bg-secondary'
      case 'error':
        return 'bg-destructive/10'
      default:
        return 'bg-foreground/10'
    }
  }

  const getTextColor = () => {
    switch (type) {
      case 'success':
        return 'text-secondary-foreground'
      case 'error':
        return 'text-destructive-foreground'
      default:
        return 'text-foreground'
    }
  }

  return (
    <Animated.View
      className={`absolute bottom-4 left-4 right-4 ${getBackgroundColor()} rounded-lg p-5 flex-row items-center shadow-sm`}
      style={{
        opacity: fadeAnim,
        transform: [{ translateY: slideAnim }]
      }}
    >
      {getIcon()}
      <Text className={`flex-1 ${getTextColor()} ml-3 text-xl font-bold`}>{text1}</Text>
      <Text className={`flex-1 ${getTextColor()} ml-3 text-xl`}>{text2}</Text>
      <TouchableOpacity onPress={onHide}>
        <X className='text-foreground' size={24} />
      </TouchableOpacity>
    </Animated.View>
  )
} 