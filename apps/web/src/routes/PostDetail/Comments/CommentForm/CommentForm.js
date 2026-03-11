import isMobile from 'ismobilejs'
import React, { useRef, useCallback, useState, useEffect } from 'react'
import { throttle, isEmpty } from 'lodash/fp'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { SendHorizontal } from 'lucide-react'
import { sendIsTyping } from 'client/websockets'
import AttachmentManager from 'components/AttachmentManager'
import { addAttachment, getAttachments, clearAttachments } from 'components/AttachmentManager/AttachmentManager.store'
import Button from 'components/ui/button'
import HyloEditor from 'components/HyloEditor'
import Icon from 'components/Icon'
import Loading from 'components/Loading'
import RoundImage from 'components/RoundImage'
import UploadAttachmentButton from 'components/UploadAttachmentButton'
import getMe from 'store/selectors/getMe'
import { cn, inIframe } from 'util/index'
import { STARTED_TYPING_INTERVAL } from 'util/constants'
import { useSelector, useDispatch } from 'react-redux'
import { isMobileDevice } from 'util/mobile'

import classes from './CommentForm.module.scss'

function CommentForm ({
  createComment,
  className,
  placeholder,
  editorContent,
  postId
}) {
  const { t } = useTranslation()
  const editor = useRef()
  const dispatch = useDispatch()
  const [isFocused, setIsFocused] = useState(false)
  const hasUserInteracted = useRef(false)
  const mountTime = useRef(Date.now())

  const currentUser = useSelector(getMe)
  const attachments = useSelector(
    state => getAttachments(state, { type: 'comment', id: 'new', attachmentType: 'image' }),
    (a, b) => a.length === b.length && a.every((item, index) => item?.url === b[index]?.url)
  )
  const sendIsTypingAction = useCallback((isTyping) => sendIsTyping(postId, isTyping), [postId])
  const addAttachmentAction = useCallback(attachment => dispatch(addAttachment('comment', 'new', attachment)), [dispatch])
  const clearAttachmentsAction = useCallback(() => dispatch(clearAttachments('comment')), [dispatch])

  const startTyping = useCallback(throttle(STARTED_TYPING_INTERVAL, () => {
    sendIsTypingAction(true)
  }), [])

  const handleSubmit = useCallback(contentHTML => {
    if (editor?.current && isEmpty(attachments) && editor.current.isEmpty()) {
      window.alert(t('You need to include text to post a comment'))
      return true
    }

    editor.current.clearContent()
    startTyping.cancel()
    sendIsTypingAction(false)
    createComment({ text: contentHTML, attachments })
    clearAttachmentsAction()

    return true
  }, [attachments, clearAttachmentsAction, createComment, sendIsTypingAction, startTyping])

  const placeholderText = placeholder || t('Add a comment...')

  // Track user interactions to distinguish between automatic and user-initiated focus
  useEffect(() => {
    const handleUserInteraction = () => {
      hasUserInteracted.current = true
    }

    // Listen for any user interaction
    document.addEventListener('touchstart', handleUserInteraction, { once: true, passive: true })
    document.addEventListener('mousedown', handleUserInteraction, { once: true, passive: true })

    return () => {
      document.removeEventListener('touchstart', handleUserInteraction)
      document.removeEventListener('mousedown', handleUserInteraction)
    }
  }, [])

  const handleFocus = useCallback(() => {
    // On mobile, only prevent automatic focus (within first 500ms after mount or before user interaction)
    // Allow user-initiated focus so they can tap to open the keyboard
    if (isMobileDevice() && editor?.current) {
      const timeSinceMount = Date.now() - mountTime.current
      const isAutomaticFocus = !hasUserInteracted.current && timeSinceMount < 500

      if (isAutomaticFocus) {
        // This is an automatic focus - prevent it
        editor.current.blur()
        return
      }
      // This is user-initiated - allow it
    }
    setIsFocused(true)
  }, [])

  const handleContainerMouseDown = useCallback(event => {
    // Don't auto-focus on mobile devices to prevent keyboard from opening
    if (isMobileDevice()) {
      return
    }
    if (!isFocused) {
      editor?.current?.focus()
    }
  }, [editor, isFocused])

  return (
    <>
      <div
        className={cn(
          'CommentForm flex flex-col items-start justify-between bg-input items-center rounded-lg p-2 border-2 border-transparent',
          { 'border-2 border-focus': isFocused },
          className
        )}
        onMouseDown={handleContainerMouseDown}
      >
        <div className={cn('ml-0 mr-0 w-full cursor-text flex items-center overflow-x-hidden', { [classes.disabled]: !currentUser })}>
          {currentUser
            ? <RoundImage url={currentUser.avatarUrl} small className='w-6 h-6' />
            : <Icon name='Person' className={classes.anonymousImage} dataTestId='icon-Person' />}

          <HyloEditor
            contentHTML={editorContent}
            onAltEnter={handleSubmit}
            className='w-full max-h-[200px] overflow-y-auto cursor-text flex'
            readOnly={!currentUser}
            onUpdate={startTyping}
            onFocus={handleFocus}
            onBlur={() => setIsFocused(false)}
            placeholder={placeholderText}
            ref={editor}
          />

          {!currentUser
            ? (
              <Link
                to={`/login?returnToUrl=${encodeURIComponent(window.location.pathname)}`}
                target={inIframe() ? '_blank' : ''}
                className={classes.signupButton}
              >
                {t('Sign up to reply')}
              </Link>
              )
            : (
              <div className='flex items-center gap-2'>
                <div>
                  <Button
                    variant='ghost'
                    size='icon'
                    onClick={() => handleSubmit(editor.current.getHTML())}
                    className='bg-selected text-foreground hover:scale-102 focus-visible:outline-none'
                    tooltip={t('You need to include text to post a comment')}
                  >
                    <SendHorizontal size={18} color='white' />
                  </Button>
                </div>
                <UploadAttachmentButton
                  type='comment'
                  id='new'
                  allowMultiple
                  onSuccess={addAttachmentAction}
                  customRender={renderProps => (
                    <UploadButton {...renderProps} className='flex items-center justify-center w-6 h-6 p-0 hover:bg-focus' />
                  )}
                />
              </div>
              )}
        </div>
        {currentUser && (
          <AttachmentManager type='comment' id='new' attachmentType='image' />
        )}
      </div>
      <p className='text-xs text-foreground/50 text-end'>
        {!isMobile.any && (navigator.platform.includes('Mac') ? t('Press Option-Enter to comment') : t('Press Alt-Enter to comment'))}
      </p>
    </>
  )
}
function UploadButton ({
  onClick,
  loading,
  className
}) {
  return (
    <div onClick={onClick} className={className} data-testid='upload-button'>
      {loading && <Loading type='inline' className={classes.uploadButtonLoading} />}
      {!loading && <Icon name='AddImage' className={classes.uploadButtonIcon} />}
    </div>
  )
}

export default CommentForm
