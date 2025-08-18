import React from 'react'
import { Text, View, TouchableOpacity } from 'react-native'
import { omit } from 'lodash/fp'
import Icon from 'components/Icon'
import { white } from '@hylo/presenters/colors'
import Colors from '../../style/theme-colors'

export default function Button (props) {
  const {
    style: providedStyles = {},
    text,
    customIconRender,
    onPress,
    iconName,
    disabled
  } = props
  const {
    borderRadius = 100,
    fontSize = 13,
    height = 30
  } = providedStyles

  const containerStyle = {
    ...styles.container,
    ...omit([
      'color',
      'backgroundColor',
      'disabledBackgroundColor',
      'fontSize',
      'height'
    ], providedStyles)
  }

  const backgroundColor = disabled
    ? providedStyles.disabledBackgroundColor
    : providedStyles.backgroundColor || Colors.selected
  const color = disabled
    ? providedStyles.disabledColor
    : providedStyles.color || white
  const borderColor = color
  const buttonStyle = { ...styles.button, backgroundColor, height, borderRadius, borderColor }
  const textStyle = { ...styles.text, color, fontSize }
  const iconStyle = { ...styles.icon, color, ...providedStyles.icon }

  return (
    <View style={containerStyle}>
      <TouchableOpacity disabled={disabled} onPress={disabled ? () => {} : onPress} style={styles.wrapper}>
        <View style={buttonStyle}>
          <View style={styles.buttonInner}>
            {!!customIconRender && customIconRender({ ...props, name: iconName, style: iconStyle })}
            {!customIconRender && !!iconName && <Icon name={iconName} style={iconStyle} />}
            <Text style={textStyle}>{text}</Text>
          </View>
        </View>
      </TouchableOpacity>
    </View>
  )
}

const styles = {
  container: {
    alignItems: 'center'
  },
  wrapper: {
    flexDirection: 'row'
  },
  button: {
    justifyContent: 'center',
    alignItems: 'center',
    flex: 1,
    borderWidth: 1
  },
  buttonInner: {
    flex: 1,
    alignItems: 'center',
    flexDirection: 'row'
  },
  text: {
    fontFamily: 'Circular-Bold'
  },
  icon: {
    color: white,
    fontSize: 16,
    paddingRight: 5
  }
}
