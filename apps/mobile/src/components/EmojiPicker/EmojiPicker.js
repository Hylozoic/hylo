import React, { useState } from 'react'
import appleEmojiData from 'emoji-mart-native/data/apple.json'
import appleEmojiDataRequires from 'emoji-mart-native/data/local-images/apple'
import { ModalPicker } from 'emoji-mart-native'
import { View, TouchableOpacity } from 'react-native'
import Icon from 'components/Icon'
import { bigStone } from 'style/colors'

const { emojis: appleEmojis } = appleEmojiDataRequires

export default function EmojiPicker (props) {
  const {
    handleRemoveReaction,
    myEmojis,
    handleReaction,
    modalOpened = false,
    onRequestClose,
    includePicker = false
  } = props
  const [modalOpen, setModalOpen] = useState(modalOpened)

  const handleClick = (data) => {
    const selectedEmoji = data.native
    if (myEmojis.includes(selectedEmoji)) {
      handleRemoveReaction(selectedEmoji)
    } else {
      handleReaction(selectedEmoji)
    }
    onRequestClose && onRequestClose()
    setModalOpen(!modalOpen)
    return true
  }

  const toggleModalOpen = () => setModalOpen(!modalOpen)

  return (
    <View>
      {includePicker && (
        <TouchableOpacity onPress={toggleModalOpen} hitSlop={{ top: 15, left: 20, bottom: 20, right: 20 }}>
          <View>
            <Icon style={{ marginLeft: 10, fontSize: 16, color: bigStone }} name='Smiley' />
          </View>
        </TouchableOpacity>
      )}
      <ModalPicker
        isVisible={modalOpen}
        showCloseButton
        set='apple'
        data={appleEmojiData}
        useLocalImages={appleEmojis}
        {...props}
        theme='light'
        onPressClose={onRequestClose || toggleModalOpen}
        onSelect={handleClick}
      />
    </View>
  )
}
