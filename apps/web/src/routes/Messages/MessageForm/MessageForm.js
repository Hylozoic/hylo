import { cn } from 'util/index'
import PropTypes from 'prop-types'
import React, { useState, useRef, forwardRef } from 'react'
import { useTranslation } from 'react-i18next'
import { throttle } from 'lodash'
import TextareaAutosize from 'react-textarea-autosize'
import { onEnterNoShift } from 'util/textInput'
import { STARTED_TYPING_INTERVAL } from 'util/constants'
import { Loader2, Send } from 'lucide-react'
import { isMobileDevice } from 'util/mobile'

const MessageForm = forwardRef((props, ref) => {
  const [hasFocus, setHasFocus] = useState(false)
  const { t } = useTranslation()
  const _ref = useRef(null)
  const textareaRef = ref || _ref

  const handleSubmit = event => {
    if (event) event.preventDefault()
    startTyping.cancel()
    props.sendIsTyping(false)
    props.updateMessageText('')
    // Clear the text but maintain focus
    props.onSubmit()
    // Maintain focus after submit
    if (textareaRef.current) {
      // Use preventScroll on mobile to avoid scrolling issues (Visual Viewport API handles it)
      if (isMobileDevice()) {
        textareaRef.current.focus({ preventScroll: true })
      } else {
        textareaRef.current.focus()
      }
    }
  }

  const handleOnChange = e => {
    props.updateMessageText(e.target.value)
  }

  const handleKeyDown = event => {
    startTyping()
    onEnterNoShift(handleSubmit, event)
  }

  // broadcast "I'm typing!" every 3 seconds starting when the user is typing.
  // We send repeated notifications to make sure that a user gets notified even
  // if they load a comment thread after someone else has already started
  // typing.
  const startTyping = throttle(() => {
    props.sendIsTyping(true)
  }, STARTED_TYPING_INTERVAL)

  const canSend = Boolean(props.messageText?.trim()) && !props.pending && !props.disabled

  // Styled to match the group chat composer (ChatEditorContent), so DMs and
  // chat read as one messaging experience.
  return (
    <form
      className={cn(
        'w-full max-w-[750px] mx-auto flex items-end gap-2 bg-foreground/5 border border-foreground/10 rounded-xl p-1.5 pl-3 transition-all',
        props.className,
        { 'border-foreground/20': hasFocus }
      )}
      onSubmit={handleSubmit}
    >
      <TextareaAutosize
        value={props.messageText}
        className='text-foreground bg-transparent w-full py-2 line-height-2 focus:outline-none'
        ref={textareaRef}
        minRows={1}
        maxRows={8}
        onChange={handleOnChange}
        onKeyDown={handleKeyDown}
        onFocus={(e) => {
          setHasFocus(true)
          // Note: We rely on preventScroll: true in focus() calls and Visual Viewport API
          // for proper keyboard handling. No manual scroll prevention needed here.
          if (props.onFocus) props.onFocus(e)
        }}
        onBlur={() => {
          setHasFocus(false)
        }}
        placeholder={props.placeholder || t('Write something...')}
        disabled={props.pending || props.disabled}
      />
      {props.pending
        ? (
          <div className='flex items-center gap-1 p-1.5 mb-0.5 text-sm text-foreground/50 shrink-0'>
            <Loader2 className='w-4 h-4 animate-spin' /> {t('Sending...')}
          </div>
          )
        : (
          <button
            className={cn(
              'p-1.5 mb-0.5 shrink-0 rounded-lg border transition-colors',
              canSend
                ? 'bg-selected border-selected text-white hover:bg-selected/90'
                : 'border-foreground/20 text-muted-foreground cursor-not-allowed'
            )}
            disabled={!canSend}
            aria-label={t('Send')}
            data-testid='send-button'
          >
            <Send className='w-5 h-5' />
          </button>
          )}
    </form>
  )
})

MessageForm.displayName = 'MessageForm'

MessageForm.propTypes = {
  className: PropTypes.string,
  messageText: PropTypes.string,
  onSubmit: PropTypes.func.isRequired,
  pending: PropTypes.bool,
  placeholder: PropTypes.string,
  sendIsTyping: PropTypes.func,
  updateMessageText: PropTypes.func
}

export default MessageForm
