import { cn } from 'util/index'
import { SmilePlus } from 'lucide-react'
import Picker from '@emoji-mart/react'
import React, { useState, useEffect } from 'react'
import {
  Popover,
  PopoverContent,
  PopoverTrigger
} from 'components/ui/popover'

import classes from './EmojiPicker.module.scss'

export default function EmojiPicker (props) {
  const { handleRemoveReaction, myEmojis, handleReaction, forReactions = true, emoji, onOpenChange } = props
  const [modalOpen, setModalOpen] = useState(false)

  const handleOpenChange = (isOpen) => {
    setModalOpen(isOpen)
    if (onOpenChange) {
      onOpenChange(isOpen)
    }
  }

  const handleSelection = (data) => {
    const selectedEmoji = data.native
    if (myEmojis && myEmojis.includes(selectedEmoji)) {
      handleRemoveReaction(selectedEmoji)
    } else {
      handleReaction(selectedEmoji)
    }
    handleOpenChange(!modalOpen)

    return true
  }

  const stopPropagation = (evt) => {
    evt.preventDefault()
    evt.stopPropagation()
    return false
  }

  const toggleModalOpen = (evt) => {
    handleOpenChange(!modalOpen)
    evt.preventDefault()
    evt.stopPropagation()
    return false
  }

  return forReactions
    ? (
      <div onClick={stopPropagation} className={cn(classes.emojiPickerContainer, props.className)}>
        <Popover onOpenChange={handleOpenChange} open={modalOpen}>
          <PopoverTrigger asChild>
            <div className={classes.emojiPickerToggle} onClick={toggleModalOpen}>
              <SmilePlus className='h-[20px]' />
            </div>
          </PopoverTrigger>
          <PopoverContent className='w-auto p-0' hideWhenDetached sideOffset={0}>
            <div>
              <EmojiPickerContent {...props} onEmojiSelect={handleSelection} />
            </div>
          </PopoverContent>
        </Popover>
      </div>
      )
    : (
      <div onClick={stopPropagation} className={cn(classes.emojiPickerContainer, props.className)}>
        <Popover onOpenChange={handleOpenChange} open={modalOpen}>
          <PopoverTrigger asChild>
            <span onClick={toggleModalOpen}>{emoji || '?'}</span>
          </PopoverTrigger>
          <PopoverContent className='w-auto p-0' hideWhenDetached sideOffset={0}>
            <EmojiPickerContent {...props} onEmojiSelect={handleSelection} />
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
