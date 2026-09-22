import { cn } from 'util/index'
import PropTypes from 'prop-types'
import React, { useState, useRef, forwardRef, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { throttle, isEmpty } from 'lodash'
import { useDispatch, useSelector } from 'react-redux'
import TextareaAutosize from 'react-textarea-autosize'
import { ImagePlus, Loader2, Paperclip, Plus, Send } from 'lucide-react'
import { onEnterNoShift } from 'util/textInput'
import { STARTED_TYPING_INTERVAL } from 'util/constants'
import AttachmentManager from 'components/AttachmentManager'
import { addAttachment, getAttachments, clearAttachments, getUploadAttachmentPending } from 'components/AttachmentManager/AttachmentManager.store'
import UploadAttachmentButton from 'components/UploadAttachmentButton'
import {
  Popover,
  PopoverContent,
  PopoverTrigger
} from 'components/ui/popover'
import { isMobileDevice } from 'util/mobile'

const MessageForm = forwardRef((props, ref) => {
  const [hasFocus, setHasFocus] = useState(false)
  const [attachMenuOpen, setAttachMenuOpen] = useState(false)
  const [attachmentUploading, setAttachmentUploading] = useState(false)
  const [uploadingAttachmentType, setUploadingAttachmentType] = useState(null)
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
  const uploadAttachmentPending = useSelector(state =>
    getUploadAttachmentPending(state, { type: 'comment', id: 'new' })
  )
  const attaching = attachmentUploading || !!uploadAttachmentPending
  const busy = props.pending || attaching
  const addAttachmentAction = useCallback(attachment => dispatch(addAttachment('message', 'new', attachment)), [dispatch])
  const clearAttachmentsAction = useCallback(() => dispatch(clearAttachments('message')), [dispatch])
  const handleAttachmentLoadingChange = useCallback((next, attachmentType) => {
    setAttachmentUploading(next)
    setUploadingAttachmentType(next ? attachmentType : null)
    if (next) setAttachMenuOpen(false)
  }, [])

  const handleSubmit = event => {
    if (event) event.preventDefault()
    if (busy) return
    const text = props.messageText
    if (!text?.trim() && isEmpty(attachments)) return

    startTyping.cancel()
    props.sendIsTyping(false)
    props.onSubmit({ text, attachments })
    props.updateMessageText('')
    clearAttachmentsAction()

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

  const canSend = (Boolean(props.messageText?.trim()) || !isEmpty(attachments)) && !busy && !props.disabled

  // Styled to match the group chat composer (ChatEditorContent), so DMs and
  // chat read as one messaging experience.
  return (
    <form
      className={cn(
        'w-full flex flex-col gap-2 bg-foreground/5 border border-foreground/10 rounded-xl p-1.5 pl-3 transition-all',
        props.className,
        { 'border-foreground/20': hasFocus }
      )}
      onSubmit={handleSubmit}
    >
      <div className='w-full flex items-end gap-2'>
        <Popover open={attachMenuOpen} onOpenChange={setAttachMenuOpen}>
          <PopoverTrigger asChild>
            <button
              type='button'
              className='p-1.5 mb-0.5 shrink-0 text-foreground/50 hover:text-foreground transition-colors'
              aria-label={t('Add attachment')}
              data-testid='upload-button'
            >
              <Plus className='w-6 h-6' />
            </button>
          </PopoverTrigger>
          <PopoverContent side='top' align='start' className='w-48 p-1'>
            <UploadAttachmentButton
              type='comment'
              id='new'
              attachmentType='image'
              onSuccess={(attachment) => {
                addAttachmentAction(attachment)
                setAttachMenuOpen(false)
              }}
              onLoadingChange={(next) => handleAttachmentLoadingChange(next, 'image')}
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
              onLoadingChange={(next) => handleAttachmentLoadingChange(next, 'file')}
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
        {busy
          ? (
            <div
              className='flex items-center gap-1 p-1.5 mb-0.5 text-sm text-foreground/50 shrink-0'
              data-testid='message-form-spinner'
              role='status'
              aria-label={props.pending ? t('Sending...') : t('Loading...')}
            >
              <Loader2 className='w-5 h-5 animate-spin' />
              {props.pending ? t('Sending...') : null}
            </div>
            )
          : (
            <button
              type='submit'
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
      </div>
      <AttachmentManager
        type='message'
        id='new'
        attachmentType='image'
        showLoading
        uploadAttachmentPending={attaching && uploadingAttachmentType === 'image'}
      />
      <AttachmentManager
        type='message'
        id='new'
        attachmentType='file'
        showLoading
        uploadAttachmentPending={attaching && uploadingAttachmentType === 'file'}
      />
    </form>
  )
})

MessageForm.displayName = 'MessageForm'

MessageForm.propTypes = {
  className: PropTypes.string,
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
