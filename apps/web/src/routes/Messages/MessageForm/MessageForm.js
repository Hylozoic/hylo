import { cn } from 'util/index'
import PropTypes from 'prop-types'
import React, { useState, useRef, forwardRef } from 'react'
import { useTranslation } from 'react-i18next'
import { throttle } from 'lodash'
import { get } from 'lodash/fp'
import TextareaAutosize from 'react-textarea-autosize'
import { onEnterNoShift } from 'util/textInput'
import { STARTED_TYPING_INTERVAL } from 'util/constants'
import RoundImage from 'components/RoundImage'
import Icon from 'components/Icon'
import styles from './MessageForm.module.scss'

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
      textareaRef.current.focus()
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

  return (
    <form
      className={cn('w-full max-w-[750px] fixed bottom-0 flex gap-3 px-2 shadow-md p-2 border-2 border-foreground/15 shadow-xlg rounded-t-xl bg-card pb-4 transition-all', props.className, { 'border-focus': hasFocus })}
      onSubmit={handleSubmit}
    >
      <RoundImage url={get('avatarUrl', props.currentUser)} medium />
      <TextareaAutosize
        value={props.messageText}
        className='text-foreground bg-transparent w-full my-2 focus:outline-none mt-0'
        ref={textareaRef}
        minRows={1}
        maxRows={8}
        onChange={handleOnChange}
        onKeyDown={handleKeyDown}
        onFocus={(e) => {
          setHasFocus(true)
          if (props.onFocus) props.onFocus(e)
        }}
        onBlur={() => setHasFocus(false)}
        placeholder={props.placeholder || t('Write something...')}
        disabled={props.pending}
      />
      {props.pending
        ? (
          <div className='flex items-center text-sm text-foreground/50'>
            Sending...
          </div>
          )
        : (
          <button className={styles.sendButton} data-testid='send-button'>
            <Icon name='Reply' className={styles.replyIcon} />
          </button>
          )}
    </form>
  )
})

MessageForm.displayName = 'MessageForm'

MessageForm.propTypes = {
  className: PropTypes.string,
  currentUser: PropTypes.object,
  messageText: PropTypes.string,
  onSubmit: PropTypes.func.isRequired,
  pending: PropTypes.bool,
  placeholder: PropTypes.string,
  sendIsTyping: PropTypes.func,
  updateMessageText: PropTypes.func
}

export default MessageForm
