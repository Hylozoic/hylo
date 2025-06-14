import React from 'react'
import { View, TouchableOpacity, Text } from 'react-native'
import Icon from 'components/Icon'
import { bigStone } from 'style/colors'
import { EmojiPopup } from 'react-native-emoji-popup'

export default function EmojiPicker (props) {
  const {
    handleRemoveReaction,
    myEmojis,
    handleReaction,
    onRequestClose,
    includePicker = false
  } = props

  const handleEmojiSelected = (selectedEmoji) => {
    if (myEmojis.includes(selectedEmoji)) {
      handleRemoveReaction(selectedEmoji)
    } else {
      handleReaction(selectedEmoji)
    }
    onRequestClose && onRequestClose()
  }

  if (!includePicker) {
    return null
  }

  const CloseButton = ({ close }) => (
    <TouchableOpacity onPress={close}>
      <Text className='text-sm font-medium text-gray-600 px-2 py-1'>Close ❌</Text>
    </TouchableOpacity>
  )

  return (
    <View 
      onStartShouldSetResponder={() => true}
      onResponderRelease={() => {}}
    >
      <EmojiPopup
        onEmojiSelected={handleEmojiSelected}
        style={{ marginLeft: 10 }}
        closeButton={CloseButton}
      >
        <Icon style={{ fontSize: 16, color: bigStone }} name='Smiley' />
      </EmojiPopup>
    </View>
  )
}
