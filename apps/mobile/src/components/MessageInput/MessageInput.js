import React, { useState, useEffect, useRef, useCallback, useImperativeHandle } from 'react'
import { TextInput, TouchableOpacity, View, Alert, StyleSheet } from 'react-native'
import { useTranslation } from 'react-i18next'
import { throttle, isEmpty } from 'lodash'
import Icon from 'components/Icon'
import { azureRadiance, rhino30, alabaster, rhino } from 'style/colors'

const IS_TYPING_THROTTLE = 3000
const MAX_INPUT_HEIGHT = 180

const MessageInput = React.forwardRef(({
  onSubmit,
  emptyParticipants,
  multiline,
  placeholder,
  sendIsTyping,
  style
}, ref) => {
  const [message, setMessage] = useState('')
  const [submittable, setSubmittable] = useState(false)
  const textInputRef = useRef(null)
  const { t } = useTranslation()

  useEffect(() => {
    setSubmittable(message.trim().length > 0)
  }, [message])

  const clear = () => {
    setSubmittable(false)
    setMessage('')
    textInputRef.current?.clear()
  }

  const handleChange = (text) => {
    if (!isEmpty(text)) startTyping()
    setSubmittable(text.trim().length > 0)
    setMessage(text)
  }

  const handleSubmit = async () => {
    const canSend = submittable || message.length > 0
    if (canSend && !emptyParticipants) {
      await onSubmit(message)
      clear()
    } else if (emptyParticipants) {
      Alert.alert(
        t('Missing message recipient!'),
        t('Click on a user name or use the search bar'),
        [{ text: t('Ok') }],
        { cancelable: true }
      )
    }
  }

  const startTyping = useCallback(
    throttle(() => {
      if (sendIsTyping) sendIsTyping()
    }, IS_TYPING_THROTTLE),
    [sendIsTyping]
  )

  useImperativeHandle(ref, () => ({
    getMessageText: () => message
  }))

  return (
    <View style={[styles.container, style]}>
      <TextInput
        multiline={multiline}
        placeholderTextColor={rhino30}
        placeholder={placeholder}
        value={message}
        onChangeText={handleChange}
        underlineColorAndroid='transparent'
        ref={textInputRef}
        style={styles.input}
      />
      <TouchableOpacity onPress={handleSubmit}>
        <Icon
          name='Send'
          style={{ ...styles.sendButton, color: submittable ? azureRadiance : rhino30 }}
        />
      </TouchableOpacity>
    </View>
  )
})

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: alabaster,
    paddingLeft: 10,
    paddingVertical: 5,
    shadowColor: rhino,
    shadowOffset: { width: 2, height: 5 },
    shadowRadius: 10,
    shadowOpacity: 0.5,
    elevation: 2 // Android-only
  },
  input: {
    flex: 1,
    backgroundColor: alabaster,
    maxHeight: MAX_INPUT_HEIGHT,
    padding: 5,
    borderRadius: 10,
    fontSize: 18,
    fontFamily: 'Circular-Book',
    marginRight: -7
  },
  sendButton: {
    fontSize: 60
  }
})

export default MessageInput
