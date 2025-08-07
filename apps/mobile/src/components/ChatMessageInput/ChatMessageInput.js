import React, { useCallback, useRef, useState } from 'react'
import { View, TextInput, TouchableOpacity, StyleSheet } from 'react-native'
import { useTranslation } from 'react-i18next'
import { Send, Paperclip, Smile } from 'lucide-react-native'
import EmojiPicker from 'react-native-emoji-popup'

/**
 * Chat message input component with emoji support and file attachments
 */
export default function ChatMessageInput ({
  onSend,
  placeholder,
  multiline = true,
  disabled = false,
  style
}) {
  const { t } = useTranslation()
  const [message, setMessage] = useState('')
  const [showEmojiPicker, setShowEmojiPicker] = useState(false)
  const inputRef = useRef(null)

  const handleSend = useCallback(() => {
    if (message.trim() && !disabled) {
      onSend?.(message.trim())
      setMessage('')
      inputRef.current?.focus()
    }
  }, [message, disabled, onSend])

  const handleEmojiSelect = useCallback((emoji) => {
    const newMessage = message + emoji.emoji
    setMessage(newMessage)
    setShowEmojiPicker(false)
    inputRef.current?.focus()
  }, [message])

  const handleAttachment = useCallback(() => {
    // TODO: Implement file attachment picker
    console.log('Attachment picker not yet implemented')
  }, [])

  const canSend = message.trim().length > 0 && !disabled

  return (
    <View style={[styles.container, style]}>
      <View style={styles.inputContainer}>
        {/* Attachment Button */}
        <TouchableOpacity
          style={styles.iconButton}
          onPress={handleAttachment}
          disabled={disabled}
        >
          <Paperclip size={20} color={disabled ? '#ccc' : '#666'} />
        </TouchableOpacity>

        {/* Text Input */}
        <TextInput
          ref={inputRef}
          style={[styles.textInput, multiline && styles.multilineInput]}
          value={message}
          onChangeText={setMessage}
          placeholder={placeholder || t('Write a message...')}
          placeholderTextColor='#8B96A5'
          multiline={multiline}
          maxLength={10000}
          editable={!disabled}
          returnKeyType={multiline ? 'default' : 'send'}
          onSubmitEditing={!multiline ? handleSend : undefined}
          blurOnSubmit={!multiline}
        />

        {/* Emoji Button */}
        <TouchableOpacity
          style={styles.iconButton}
          onPress={() => setShowEmojiPicker(!showEmojiPicker)}
          disabled={disabled}
        >
          <Smile size={20} color={disabled ? '#ccc' : '#666'} />
        </TouchableOpacity>

        {/* Send Button */}
        <TouchableOpacity
          style={[styles.sendButton, canSend && styles.sendButtonActive]}
          onPress={handleSend}
          disabled={!canSend}
        >
          <Send size={18} color={canSend ? '#fff' : '#ccc'} />
        </TouchableOpacity>
      </View>

      {/* Emoji Picker */}
      {showEmojiPicker && (
        <EmojiPicker
          onEmojiSelected={handleEmojiSelect}
          onClose={() => setShowEmojiPicker(false)}
          showSearchBar={false}
          showSectionTitles={false}
          showCategoryTab={false}
          style={styles.emojiPicker}
        />
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#e1e5e9'
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 16,
    paddingVertical: 12,
    minHeight: 56
  },
  iconButton: {
    padding: 8,
    justifyContent: 'center',
    alignItems: 'center'
  },
  textInput: {
    flex: 1,
    fontSize: 16,
    lineHeight: 20,
    color: '#2C405A',
    backgroundColor: '#f8f9fa',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginHorizontal: 8,
    minHeight: 40,
    maxHeight: 120
  },
  multilineInput: {
    textAlignVertical: 'top'
  },
  sendButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#ccc',
    justifyContent: 'center',
    alignItems: 'center'
  },
  sendButtonActive: {
    backgroundColor: '#007bff'
  },
  emojiPicker: {
    height: 250,
    backgroundColor: '#fff'
  }
})
