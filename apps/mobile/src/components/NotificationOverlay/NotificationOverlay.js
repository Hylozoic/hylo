import React from 'react'
import { Animated, StyleSheet, Text, TouchableOpacity } from 'react-native'
import { func, string } from 'prop-types'
import { amaranth, persimmon } from 'style/colors'
import { compact } from 'lodash'

export default class NotificationOverlay extends React.Component {
  static propTypes = {
    message: string.isRequired,
    onPress: func
  }

  constructor () {
    super()
    this.state = {
      heightAnim: new Animated.Value(0)
    }
  }

  componentDidMount () {
    this.animate()
  }

  componentDidUpdate (prevProps) {
    if (prevProps.message !== this.props.message) {
      this.animate()
    }
  }

  animate () {
    const { onComplete, permanent } = this.props
    const height = lineHeight + padding * 2
    Animated.sequence(compact([
      Animated.timing(
        this.state.heightAnim,
        { toValue: height, duration: 800, useNativeDriver: false }
      ),
      !permanent && Animated.delay(4000),
      !permanent && Animated.timing(
        this.state.heightAnim,
        { toValue: 0, duration: 800, useNativeDriver: false },
      )
    ])).start(({ finished }) => {
      if (finished && onComplete) onComplete()
    })
  }

  render () {
    const { position = 'top', type = 'error', onPress, message } = this.props

    return (
      <Animated.View style={[
        styles.container,
        styles[position + 'Position'],
        { height: this.state.heightAnim }
      ]}
    >
        <TouchableOpacity onPress={onPress}>
          <Text style={[styles.message, styles[type]]}>
            {message}
          </Text>
        </TouchableOpacity>
      </Animated.View>
    )
  }
}

const fontSize = 13
const lineHeight = 14
const padding = 6

const styles = StyleSheet.create({
  message: {
    backgroundColor: persimmon,
    color: 'white',
    fontFamily: 'Circular-Bold',
    fontSize,
    // Note: letterSpacing not supported on Android
    // letterSpacing: 0.2,
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
