import React from 'react'
import { Text, View } from 'react-native'
import Triangle from 'react-native-triangle'
import { amaranth, white } from '@hylo/presenters/colors'
import { get } from 'lodash/fp'

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
    <Triangle
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
