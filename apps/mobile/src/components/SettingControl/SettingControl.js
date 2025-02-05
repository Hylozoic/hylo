import React, { useState, useRef, useEffect } from 'react'
import { View, Text, TextInput, TouchableOpacity } from 'react-native'
import styles from './SettingControl.styles.js'
import EntypoIcon from 'react-native-vector-icons/Entypo'
import FormattedError from 'components/FormattedError'

const SettingControl = ({
  label,
  value,
  onChange,
  onFocus,
  toggleSecureTextEntry,
  toggleEditable,
  keyboardType,
  returnKeyType,
  autoCapitalize,
  autoCorrect,
  style,
  error,
  theme = {},
  onSubmitEditing
}) => {
  const [securePassword, setSecurePassword] = useState(true)
  const [editable, setEditable] = useState(!toggleEditable)
  const [highlight, setHighlight] = useState(false)

  const inputRef = useRef(null)

  useEffect(() => {
    if (toggleEditable) {
      setEditable(false)
    }
  }, [toggleEditable])

  const handleTogglePassword = () => {
    setSecurePassword(prev => !prev)
  }

  const handleToggleEditable = () => {
    if (editable) {
      handleOnSubmitEditing()
    } else {
      setEditable(true)
    }
  }

  const handleOnSubmitEditing = () => {
    if (toggleEditable) setEditable(false)
    if (onSubmitEditing) onSubmitEditing()
    if (highlight) setHighlight(false)
  }

  return (
    <View style={[styles.control, style, theme.control]}>
      <Text style={[styles.label, theme.label]}>{label}</Text>
      <TextInput
        ref={inputRef}
        style={[styles.textInput, theme.textInput]}
        onChangeText={onChange}
        onFocus={onFocus}
        value={value}
        secureTextEntry={toggleSecureTextEntry && securePassword}
        textContentType='oneTimeCode'
        autoCapitalize={autoCapitalize}
        autoCorrect={autoCorrect}
        keyboardType={keyboardType}
        returnKeyType={returnKeyType}
        onSubmitEditing={handleOnSubmitEditing}
        editable={editable}
      />
      {(toggleSecureTextEntry || toggleEditable) && (
        <View style={styles.toggles}>
          {toggleSecureTextEntry && (
            <TouchableOpacity
              onPress={handleTogglePassword}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <EntypoIcon
                name={securePassword ? 'eye' : 'eye-with-line'}
                style={[styles.eyeIcon, theme.eyeIcon]}
              />
            </TouchableOpacity>
          )}
          {toggleEditable && (
            <View style={highlight && styles.highlight}>
              <TouchableOpacity
                onPress={handleToggleEditable}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <EntypoIcon name={editable ? 'check' : 'edit'} style={styles.editIcon} />
              </TouchableOpacity>
            </View>
          )}
        </View>
      )}
      <FormattedError error={error} styles={styles} theme={theme} />
    </View>
  )
}

export default SettingControl