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

const MessageForm = forwardRef((props, ref) => {
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
      className={cn(styles.messageForm, className, { [styles.hasFocus]: hasFocus })}
      onSubmit={handleSubmit}
    >
      <RoundImage url={get('avatarUrl', currentUser)} className={styles.userImage} medium />
      <TextareaAutosize
        autoFocus
        value={messageText}
        className={styles.messageTextarea}
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
})

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
