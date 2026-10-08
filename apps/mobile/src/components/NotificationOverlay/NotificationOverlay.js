import React, { useEffect } from 'react'
import { StyleSheet, Text, TouchableOpacity } from 'react-native'
import Animated, { useSharedValue, useAnimatedStyle, withTiming, withDelay } from 'react-native-reanimated'
import { isEmpty } from 'lodash/fp'
import { amaranth, persimmon } from '@hylo/presenters/colors'

const fontSize = 13
const lineHeight = 14
const padding = 6

const NotificationOverlay = ({ message, onPress, onComplete, position = 'top', type = 'error', permanent = false }) => {
  const heightAnim = useSharedValue(0)
  const height = lineHeight + padding * 2

  // Animation logic
  useEffect(() => {
    heightAnim.value = withTiming(height, { duration: 800 }, () => {
      if (!permanent) {
        heightAnim.value = withDelay(4000, withTiming(0, { duration: 800 }, () => {
          if (onComplete) onComplete()
        }))
      }
    })
  }, [message])

  // Animated style for the container
  const animatedStyle = useAnimatedStyle(() => ({
    height: heightAnim.value
  }))

  if (isEmpty(message)) return null

  return (
    <Animated.View style={[styles.container, styles[`${position}Position`], animatedStyle]}>
      <TouchableOpacity onPress={onPress}>
        <Text style={[styles.message, styles[type]]}>
          {message}
        </Text>
      </TouchableOpacity>
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  message: {
    backgroundColor: persimmon,
    color: 'white',
    fontFamily: 'Circular-Bold',
    fontSize,
    lineHeight,
    padding,
    textAlign: 'center'
  },
  error: {
    backgroundColor: amaranth
  },
  info: {
    backgroundColor: persimmon
  },
  container: {
    position: 'absolute',
    right: 0,
    left: 0,
    elevation: 3 // Android only
  },
  topPosition: {
    top: 0
  },
  bottomPosition: {
    bottom: 0
  }
})

export default NotificationOverlay
