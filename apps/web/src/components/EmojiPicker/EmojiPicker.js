import cx from 'classnames'
import Picker from '@emoji-mart/react'
import React, { useState, useEffect } from 'react'
import Icon from 'components/Icon'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "components/ui/popover"

import classes from './EmojiPicker.module.scss'

const PICKER_DEFAULT_WIDTH = 373
const PICKER_DEFAULT_HEIGHT = 435
const DEFAULT_TOPNAV_HEIGHT = 56
const emojiPickerMaxY = PICKER_DEFAULT_HEIGHT + DEFAULT_TOPNAV_HEIGHT

export default function EmojiPicker (props) {
  const { handleRemoveReaction, myEmojis, handleReaction, forReactions = true, emoji, onOpenChange } = props
  const [modalOpen, setModalOpen] = useState(false)

  const handleOpenChange = (isOpen) => {
    setModalOpen(isOpen)
    if (onOpenChange) {
      onOpenChange(modalOpen)
    }
  }

  const handleSelection = (data) => {
    const selectedEmoji = data.native
    if (myEmojis && myEmojis.includes(selectedEmoji)) {
      handleRemoveReaction(selectedEmoji)
    } else {
      handleReaction(selectedEmoji)
    }
    setModalOpen(!modalOpen)

    return true
  }

  const toggleModalOpen = (evt) => {
    setModalOpen(!modalOpen)
    evt.preventDefault()
    evt.stopPropagation()
    return false
  }

  return forReactions
    ? (
      <div className={cx(classes.emojiPickerContainer, props.className)}>
        <Popover onOpenChange={handleOpenChange} open={modalOpen}>
          <PopoverTrigger asChild>
            <div className={classes.emojiPickerToggle} onClick={toggleModalOpen}>
              <Icon name='Smiley' className={classes.pickerIcon} />
            </div>
          </PopoverTrigger>
          <PopoverContent className='w-auto p-0' hideWhenDetached={true} sideOffset={0}>
            <div>
              <EmojiPickerContent {...props} onClickOutside={toggleModalOpen} onEmojiSelect={handleSelection} />
            </div>
          </PopoverContent>
        </Popover>
      </div>
      )
    : (
      <div onClick={toggleModalOpen} className={cx(classes.emojiPickerContainer, props.className)}>
        <Popover onOpenChange={handleOpenChange} open={modalOpen}>
          <PopoverTrigger asChild>
            <span>{emoji || '?'}</span>
          </PopoverTrigger>
          <PopoverContent className='w-auto p-0' hideWhenDetached={true} sideOffset={0}>
            <EmojiPickerContent {...props} onClickOutside={toggleModalOpen} onEmojiSelect={handleSelection} />
          </PopoverContent>
        </Popover>
      </div>
      )
}

function EmojiPickerContent (props) {
  const [data, setData] = useState()
  useEffect(() => {
    const getData = async () => {
      const response = await window.fetch(
        'https://cdn.jsdelivr.net/npm/@emoji-mart/data'
      )
      setData(response.json())
    }
    getData()
  }, [])
  return (
    <Picker {...props} theme='light' data={data} />
  )
}
