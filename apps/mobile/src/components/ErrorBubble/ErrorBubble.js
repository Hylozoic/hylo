import React from 'react'
import { Text, View } from 'react-native'
// REMOVED: react-native-triangle - replaced with CSS-based triangle
// import Triangle from 'react-native-triangle'
import { amaranth, white } from '@hylo/presenters/colors'
import { get } from 'lodash/fp'

/**
 * CSS-based triangle component to replace react-native-triangle dependency
 * Uses border styling technique to create triangular shapes
 */
function CSSTriangle ({ width = 10, height = 5, color = amaranth, direction = 'up', style }) {
  const triangleStyle = {
    width: 0,
    height: 0,
    backgroundColor: 'transparent',
    borderStyle: 'solid'
  }

  if (direction === 'up') {
    Object.assign(triangleStyle, {
      borderLeftWidth: width / 2,
      borderRightWidth: width / 2,
      borderBottomWidth: height,
      borderLeftColor: 'transparent',
      borderRightColor: 'transparent',
      borderBottomColor: color
    })
  } else if (direction === 'down') {
    Object.assign(triangleStyle, {
      borderLeftWidth: width / 2,
      borderRightWidth: width / 2,
      borderTopWidth: height,
      borderLeftColor: 'transparent',
      borderRightColor: 'transparent',
      borderTopColor: color
    })
  }

  return <View style={[triangleStyle, style]} />
}

export default function ErrorBubble ({
  text,
  topArrow,
  topRightArrow,
  bottomArrow,
  customStyles,
  errorRowStyle
}) {
  const backgroundColor = get('backgroundColor', customStyles)
  return (
    <View>
      {topArrow && <ErrorPointer style={styles.topArrow} color={backgroundColor} direction='up' />}
      {topRightArrow && <ErrorPointer style={styles.topRightArrow} color={backgroundColor} direction='up' />}

      <View style={[styles.row, errorRowStyle]}>
        <Text style={[styles.errorText, customStyles]}>{text}</Text>
      </View>
      {bottomArrow && <ErrorPointer style={styles.bottomArrow} color={backgroundColor} direction='down' />}
    </View>
  )
}

export function ErrorPointer ({ style, direction, color }) {
  return (
    <CSSTriangle
      width={10}
      height={5}
      style={style}
      direction={direction}
      color={color}
    />
  )
}

const styles = {
  topArrow: {
    marginLeft: 30,
    marginBottom: -1
  },
  topRightArrow: {
    marginLeft: 270,
    marginBottom: -1
  },
  bottomArrow: {
    marginLeft: 30,
    marginTop: -1
  },
  errorText: {
    color: amaranth,
    textAlign: 'center',
    fontWeight: 'bold'
  },
  row: {
    alignSelf: 'stretch',
    marginLeft: 5,
    marginRight: 5,
    backgroundColor: white,
    padding: 10,
    borderRadius: 30
  }
}
