import React from 'react'
import PropTypes from 'prop-types'
import { View } from 'react-native'
import FastImage from 'react-native-fast-image'
import { memoize } from 'lodash'
import defaultAvatar from 'assets/default-user-avatar.png'

export default function Avatar ({ size, hasBorder, hasOverlap, avatarUrl, zIndex, style, dimension }) {
  const styles = generateStyles({ size, hasBorder, hasOverlap, dimension })
  const source = avatarUrl ? { uri: avatarUrl } : defaultAvatar

  return (
    <View style={[styles.container, { zIndex }, style]}>
      <FastImage style={styles.image} source={source} />
    </View>
  )
}
Avatar.propTypes = {
  avatarUrl: PropTypes.string,
  forFooter: PropTypes.bool,
  hasBorder: PropTypes.bool,
  hasOverlap: PropTypes.bool,
  zIndex: PropTypes.number
}

const generateStyles = memoize(({ size = 'medium', hasBorder, hasOverlap, dimension }) => {
  const containerSize = dimension || sizes[size]
  const imageSize = hasBorder ? containerSize - BORDER_WIDTH * 2 : containerSize
  return {
    container: {
      borderRadius: containerSize / 2,
      width: containerSize,
      height: containerSize,
      borderWidth: hasBorder ? BORDER_WIDTH : 0,
      borderColor: 'white',
      marginLeft: hasOverlap ? -11 : 0
    },
    image: {
      borderRadius: imageSize / 2,
      width: imageSize,
      height: imageSize
    }
  }
}, ({ size, hasBorder, hasOverlap, dimension }) => {
  return (dimension << 3) + (size === 'small' << 2) + (hasBorder << 1) + (hasOverlap << 0)
})

const BORDER_WIDTH = 2
const sizes = {
  medium: 34,
  small: 24
}
