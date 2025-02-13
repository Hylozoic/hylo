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
import Loading from 'components/Loading'
import styles from './MessageForm.module.scss'

const MessageForm = React.memo(forwardRef((props, ref) => {
  const [hasFocus, setHasFocus] = useState(false)
  const { t } = useTranslation()
  const _ref = useRef(null)
  const textareaRef = ref || _ref

  const handleSubmit = event => {
    if (event) event.preventDefault()
    startTyping.cancel()
    props.sendIsTyping(false)
    props.updateMessageText()
    props.onSubmit()
  }

  const handleOnChange = event => {
    props.updateMessageText(event.target.value)
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

  const {
    className,
    currentUser,
    messageText,
    onFocus,
    pending,
    placeholder = t('Write something...')
  } = props

  if (pending) return <Loading />
  return (
    <form
      className={cn('w-full max-w-[750px] fixed bottom-0 flex gap-3 px-2 shadow-md p-2 border-2 border-foreground/15 shadow-xlg rounded-t-xl bg-card pb-4 transition-all', className, { 'border-focus': hasFocus })}
      onSubmit={handleSubmit}
    >
      <RoundImage url={get('avatarUrl', currentUser)} medium />
      <TextareaAutosize
        value={messageText}
        className='text-foreground bg-transparent w-full my-2 focus:outline-none mt-0'
        ref={(tag) => (textareaRef.current = tag)}
        minRows={1}
        maxRows={8}
        onChange={handleOnChange}
        onKeyDown={handleKeyDown}
        onFocus={() => { setHasFocus(true); onFocus() }}
        onBlur={() => setHasFocus(false)}
        placeholder={placeholder}
      />
      <button className={styles.sendButton} data-testid='send-button'>
        <Icon name='Reply' className={styles.replyIcon} />
      </button>
    </form>
  )
}), (prevProps, nextProps) => {
  // Only re-render if these props change
  return (
    prevProps.currentUser?.id === nextProps.currentUser?.id &&
    prevProps.messageText === nextProps.messageText &&
    prevProps.pending === nextProps.pending
  )
})

MessageForm.displayName = 'MessageForm' // For better debugging

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
