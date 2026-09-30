import { cn } from 'util/index'
import { SmilePlus } from 'lucide-react'
import Picker from '@emoji-mart/react'
import React, { useState, useEffect } from 'react'
import {
  Popover,
  PopoverContent,
  PopoverTrigger
} from 'components/ui/popover'
import { isMobileDevice } from 'util/mobile'

import classes from './EmojiPicker.module.scss'

/** Shadow-DOM search focus looks like an outside focus to the popover and would dismiss the keyboard. */
const preventFocusSteal = (event) => {
  event.preventDefault()
}

/**
 * Keeps the emoji search field focused when the mobile keyboard opens.
 * The keyboard shrinks the visual viewport, Floating UI moves the popover,
 * and iOS blurs the input — which dismisses the keyboard immediately.
 */
function useRetainEmojiSearchFocus (open) {
  useEffect(() => {
    if (!open || !isMobileDevice() || !window.visualViewport) return

    const viewport = window.visualViewport
    let lastHeight = viewport.height
    let searchWasFocused = false
    let clearFocusTimer = null

    const searchInput = () => {
      const picker = document.querySelector('em-emoji-picker')
      return picker?.shadowRoot?.querySelector('input[type="search"]') || null
    }

    const trackFocus = () => {
      const input = searchInput()
      const focused = !!input && input.getRootNode().activeElement === input
      if (focused) {
        searchWasFocused = true
        if (clearFocusTimer) window.clearTimeout(clearFocusTimer)
        return
      }
      // Blur from the keyboard animation arrives before the viewport resize.
      clearFocusTimer = window.setTimeout(() => {
        searchWasFocused = false
      }, 300)
    }

    const onResize = () => {
      const shrunk = viewport.height < lastHeight - 40
      lastHeight = viewport.height
      if (!shrunk || !searchWasFocused) return
      const input = searchInput()
      if (!input) return
      window.setTimeout(() => {
        const host = input.getRootNode()?.host
        if (!host || !document.contains(host)) return
        if (input.getRootNode().activeElement === input) return
        input.focus({ preventScroll: true })
      }, 50)
    }

    document.addEventListener('focusin', trackFocus)
    document.addEventListener('focusout', trackFocus)
    viewport.addEventListener('resize', onResize)
    return () => {
      if (clearFocusTimer) window.clearTimeout(clearFocusTimer)
      document.removeEventListener('focusin', trackFocus)
      document.removeEventListener('focusout', trackFocus)
      viewport.removeEventListener('resize', onResize)
    }
  }, [open])
}

export default function EmojiPicker (props) {
  const { handleRemoveReaction, myEmojis, handleReaction, forReactions = true, emoji, onOpenChange } = props
  const [modalOpen, setModalOpen] = useState(false)
  useRetainEmojiSearchFocus(modalOpen)

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
    handleOpenChange(false)

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
          <PopoverContent className='w-auto p-0' sideOffset={0} onOpenAutoFocus={preventFocusSteal} onFocusOutside={preventFocusSteal}>
            <EmojiPickerContent {...props} onEmojiSelect={handleSelection} />
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
          <PopoverContent className='w-auto p-0' sideOffset={0} onOpenAutoFocus={preventFocusSteal} onFocusOutside={preventFocusSteal}>
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
      setData(await response.json())
    }
    getData()
  }, [])
  return (
    <Picker {...props} theme='light' data={data} />
  )
}
