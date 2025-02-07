import React, { useState, useEffect, useRef, useCallback } from 'react'
import { TextInput, TouchableOpacity, View, Alert, StyleSheet } from 'react-native'
import { useTranslation } from 'react-i18next'
import { throttle, isEmpty } from 'lodash'
import Icon from 'components/Icon'
import { azureRadiance, rhino30, alabaster, mercury } from 'style/colors'

const IS_TYPING_THROTTLE = 3000
const MIN_INPUT_HEIGHT = 22
const MAX_INPUT_HEIGHT = 100

const MessageInput = ({ onSubmit, emptyParticipants, placeholder, sendIsTyping, style }) => {
  const [message, setMessage] = useState('')
  const [inputHeight, setInputHeight] = useState(MIN_INPUT_HEIGHT)
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

  const handleContentSizeChange = ({ nativeEvent }) => {
    setInputHeight(nativeEvent.contentSize.height)
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

  const restrictedHeight = () => Math.min(MAX_INPUT_HEIGHT, Math.max(MIN_INPUT_HEIGHT, inputHeight))

  const startTyping = useCallback(
    throttle(() => {
      if (sendIsTyping) sendIsTyping()
    }, IS_TYPING_THROTTLE),
    [sendIsTyping]
  )

  return (
    <View style={[styles.container, style]}>
      <TextInput
        placeholderTextColor={rhino30}
        placeholder={placeholder}
        value={message}
        onChangeText={handleChange}
        onContentSizeChange={handleContentSizeChange}
        underlineColorAndroid="transparent"
        ref={textInputRef}
        style={[styles.input, { height: restrictedHeight() }]}
      />
      <TouchableOpacity onPress={handleSubmit}>
        <Icon
          name="Send"
          style={{ ...styles.sendButton, color: submittable ? azureRadiance : rhino30 }}
        />
      </TouchableOpacity>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: alabaster,
    borderRadius: 4,
    marginHorizontal: 5,
    paddingHorizontal: 5,
    paddingBottom: 3,
    shadowColor: mercury,
    shadowOffset: { width: 0, height: 5 },
    shadowRadius: 10,
    shadowOpacity: 0.1,
    elevation: 2 // Android-only
  },
  input: {
    flex: 1,
    fontSize: 14,
    lineHeight: 18,
    fontFamily: 'Circular-Book',
    marginLeft: 5,
    paddingVertical: 0
  },
  sendButton: {
    fontSize: 50
  }
})

export default MessageInput
