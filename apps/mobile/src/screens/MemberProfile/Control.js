import React, { createRef } from 'react'
import {
  View,
  TouchableOpacity,
  TextInput,
  Text
} from 'react-native'
import EntypoIcon from 'react-native-vector-icons/Entypo'
import { rhino60, amaranth } from 'style/colors'

export default class Control extends React.Component {
  inputRef = createRef()

  focus = () => this.inputRef.current && this.inputRef.current.focus()

  render () {
    const {
      value,
      onChangeText,
      editable = false,
      multiline,
      isMe,
      onPress,
      hideEditIcon,
      error,
      placeholder,
      style
    } = this.props

    return (
      <View style={[styles.control, editable && styles.editableControl]}>
        <View style={styles.controlInputRow}>
          {!editable && !!value && (
            <Text style={style}>{value}</Text>
          )}
          {editable && (<>
            <TextInput
              ref={this.inputRef}
              onFocus={onPress}
              style={[styles.controlInput, style]}
              value={value}
              onChangeText={onChangeText}
              editable={editable}
              placeholder={isMe ? placeholder : ''}
              multiline={multiline}
              numberOfLines={multiline ? 8 : 1}
              underlineColorAndroid='transparent'
            />
            {!hideEditIcon && (
              <TouchableOpacity onPress={this.focus} style={styles.editIconWrapper}>
                <EntypoIcon name='edit' style={styles.editIcon} />
              </TouchableOpacity>
            )}  
          </>)}
        </View>
        {!!error && (
          <View style={styles.controlError}>
            <Text style={styles.controlErrorText}>{error}</Text>
          </View>
        )}
      </View>
    )
  }
}

const styles = {
  control: {
    flex: 1
  },
  editableControl: {
    marginBottom: 5
  },
  controlInputRow: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  controlInput: {
    textAlignVertical: 'top',
    flex: 1
  },
  editIconWrapper: {
    marginRight: 10
  },
  editIcon: {
    color: rhino60,
    fontSize: 16
  },
  controlError: {
    paddingTop: 5,
    paddingBottom: 3
  },
  controlErrorText: {
    fontSize: 13,
    fontFamily: 'Circular-Book',
    color: amaranth
  }
}
