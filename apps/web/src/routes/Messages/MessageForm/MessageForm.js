import { cn } from 'util/index'
import PropTypes from 'prop-types'
import React, { useState, useRef, forwardRef, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { throttle, isEmpty } from 'lodash'
import { get } from 'lodash/fp'
import { useDispatch, useSelector } from 'react-redux'
import TextareaAutosize from 'react-textarea-autosize'
import { ImagePlus, Loader2, Paperclip, Plus } from 'lucide-react'
import { onEnterNoShift } from 'util/textInput'
import { STARTED_TYPING_INTERVAL } from 'util/constants'
import RoundImage from 'components/RoundImage'
import Icon from 'components/Icon'
import AttachmentManager from 'components/AttachmentManager'
import { addAttachment, getAttachments, clearAttachments } from 'components/AttachmentManager/AttachmentManager.store'
import UploadAttachmentButton from 'components/UploadAttachmentButton'
import {
  Popover,
  PopoverContent,
  PopoverTrigger
} from 'components/ui/popover'
import styles from './MessageForm.module.scss'
import { isMobileDevice } from 'util/mobile'

const MessageForm = forwardRef((props, ref) => {
  const [hasFocus, setHasFocus] = useState(false)
  const [attachMenuOpen, setAttachMenuOpen] = useState(false)
  const { t } = useTranslation()
  const dispatch = useDispatch()
  const _ref = useRef(null)
  const textareaRef = ref || _ref

  const imageAttachments = useSelector(
    state => getAttachments(state, { type: 'message', id: 'new', attachmentType: 'image' }),
    (a, b) => a.length === b.length && a.every((item, index) => item?.url === b[index]?.url)
  )
  const fileAttachments = useSelector(
    state => getAttachments(state, { type: 'message', id: 'new', attachmentType: 'file' }),
    (a, b) => a.length === b.length && a.every((item, index) => item?.url === b[index]?.url)
  )
  const attachments = [...imageAttachments, ...fileAttachments]
  const addAttachmentAction = useCallback(attachment => dispatch(addAttachment('message', 'new', attachment)), [dispatch])
  const clearAttachmentsAction = useCallback(() => dispatch(clearAttachments('message')), [dispatch])

  const handleSubmit = event => {
    if (event) event.preventDefault()
    const text = props.messageText
    if (!text?.trim() && isEmpty(attachments)) return

    startTyping.cancel()
    props.sendIsTyping(false)
    props.onSubmit({ text, attachments })
    props.updateMessageText('')
    clearAttachmentsAction()

    if (textareaRef.current) {
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

  const startTyping = throttle(() => {
    props.sendIsTyping(true)
  }, STARTED_TYPING_INTERVAL)

  return (
    <form
      className={cn('w-full max-w-[750px] mx-auto flex flex-col gap-2 shadow-md p-4 border-2 border-foreground/15 shadow-xlg rounded-xl bg-card transition-all', props.className, { 'border-focus': hasFocus })}
      onSubmit={handleSubmit}
    >
      <div className='flex gap-3 w-full'>
        <RoundImage url={get('avatarUrl', props.currentUser)} medium />
        <TextareaAutosize
          value={props.messageText}
          className='text-foreground bg-transparent w-full my-2 line-height-2 focus:outline-none mt-0 mb-0'
          ref={textareaRef}
          minRows={1}
          maxRows={8}
          onChange={handleOnChange}
          onKeyDown={handleKeyDown}
          onFocus={(e) => {
            setHasFocus(true)
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
            <div className='flex items-center text-sm text-foreground/ 50'>
              <Loader2 className='w-4 h-4 animate-spin' /> Sending...
            </div>
            )
          : (
            <div className='flex items-center gap-2 flex-shrink-0'>
              <Popover open={attachMenuOpen} onOpenChange={setAttachMenuOpen}>
                <PopoverTrigger asChild>
                  <button
                    type='button'
                    className='flex items-center justify-center w-10 h-10 p-0 rounded hover:bg-focus text-foreground/70 hover:text-foreground transition-colors'
                    aria-label={t('Add attachment')}
                    data-testid='upload-button'
                  >
                    <Plus className='w-6 h-6' />
                  </button>
                </PopoverTrigger>
                <PopoverContent side='top' align='end' className='w-48 p-1'>
                  <UploadAttachmentButton
                    type='comment'
                    id='new'
                    attachmentType='image'
                    onSuccess={(attachment) => {
                      addAttachmentAction(attachment)
                      setAttachMenuOpen(false)
                    }}
                    allowMultiple
                    className='w-full'
                  >
                    <span className='flex items-center gap-2 w-full px-2 py-1.5 rounded-md cursor-pointer hover:bg-foreground/10 text-sm text-foreground'>
                      <ImagePlus className='w-4 h-4' />
                      {t('Upload image')}
                    </span>
                  </UploadAttachmentButton>
                  <UploadAttachmentButton
                    type='comment'
                    id='new'
                    attachmentType='file'
                    onSuccess={(attachment) => {
                      addAttachmentAction(attachment)
                      setAttachMenuOpen(false)
                    }}
                    allowMultiple
                    className='w-full'
                  >
                    <span className='flex items-center gap-2 w-full px-2 py-1.5 rounded-md cursor-pointer hover:bg-foreground/10 text-sm text-foreground'>
                      <Paperclip className='w-4 h-4' />
                      {t('Attach file')}
                    </span>
                  </UploadAttachmentButton>
                </PopoverContent>
              </Popover>
              <button className={styles.sendButton} data-testid='send-button' type='submit'>
                <Icon name='Reply' className={styles.replyIcon} />
              </button>
            </div>
            )}
      </div>
      <AttachmentManager type='message' id='new' attachmentType='image' />
      <AttachmentManager type='message' id='new' attachmentType='file' />
    </form>
  )
})

MessageForm.displayName = 'MessageForm'

MessageForm.propTypes = {
  className: PropTypes.string,
  currentUser: PropTypes.object,
  disabled: PropTypes.bool,
  messageText: PropTypes.string,
  onFocus: PropTypes.func,
  onSubmit: PropTypes.func.isRequired,
  pending: PropTypes.bool,
  placeholder: PropTypes.string,
  sendIsTyping: PropTypes.func,
  updateMessageText: PropTypes.func
}

export default MessageForm
