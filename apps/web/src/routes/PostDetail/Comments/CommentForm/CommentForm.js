import isMobile from 'ismobilejs'
import React, { useRef, useCallback, useEffect, useState, useImperativeHandle, forwardRef } from 'react'
import { throttle, isEmpty } from 'lodash/fp'
import { useTranslation } from 'react-i18next'
import { Link, useLocation } from 'react-router-dom'
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
import useDraft, { hasDraftContent } from 'hooks/useDraft'
import { isMobileDevice } from 'util/mobile'

import classes from './CommentForm.module.scss'

const CommentForm = forwardRef(function CommentForm ({
  createComment,
  className,
  placeholder,
  editorContent,
  postId
}, ref) {
  const { t } = useTranslation()
  const editor = useRef()
  const dispatch = useDispatch()
  const location = useLocation()
  const { pathname } = location

  const { loadedData, isLoaded, saveDraft, flushSaveDraft, clearDraft } = useDraft({
    type: 'comment',
    postId,
    navigateTo: pathname,
    debounceMs: 1000,
    skip: !postId
  })

  const draftRef = useRef(editorContent || '')

  /**
   * HyloEditor resets the whole document whenever `contentHTML` changes. `loadedData` updates
   * after each debounced save (often with normalized HTML), which was wiping trailing spaces /
   * the last few characters while the user kept typing. Cache the first resolved HTML per post
   * and only use that for the prop — not live `loadedData` after saves.
   */
  const commentEditorInitialHtmlRef = useRef({ postId: null, html: null })

  const [isFocused, setIsFocused] = useState(false)
  const hasUserInteracted = useRef(false)
  const mountTime = useRef(Date.now())
  /** True after the editor has had visible text this visit — delete server draft when cleared. */
  const commentComposerHadContentRef = useRef(false)

  const currentUser = useSelector(getMe)
  const attachments = useSelector(
    state => getAttachments(state, { type: 'comment', id: 'new', attachmentType: 'image' }),
    (a, b) => a.length === b.length && a.every((item, index) => item?.url === b[index]?.url)
  )
  const sendIsTypingAction = useCallback((isTyping) => sendIsTyping(postId, isTyping), [postId])
  const addAttachmentAction = useCallback(attachment => dispatch(addAttachment('comment', 'new', attachment)), [dispatch])
  const clearAttachmentsAction = useCallback(() => dispatch(clearAttachments('comment')), [dispatch])

  useEffect(() => {
    commentComposerHadContentRef.current = false
  }, [postId])

  const hyloContentHTML = (() => {
    if (editorContent) return editorContent
    if (!isLoaded) return ''
    if (commentEditorInitialHtmlRef.current.postId !== postId) {
      commentEditorInitialHtmlRef.current = { postId, html: null }
    }
    if (commentEditorInitialHtmlRef.current.html === null) {
      commentEditorInitialHtmlRef.current.html = loadedData || ''
    }
    return commentEditorInitialHtmlRef.current.html
  })()

  useEffect(() => {
    if (!isLoaded) return
    const draft = editorContent ?? commentEditorInitialHtmlRef.current.html ?? ''
    draftRef.current = draft
    if (editor.current) {
      editor.current.setContent(draft)
    }
  }, [editorContent, isLoaded, postId])

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
    draftRef.current = ''
    commentComposerHadContentRef.current = false
    clearDraft()

    return true
  }, [attachments, clearAttachmentsAction, clearDraft, createComment, sendIsTypingAction, startTyping])

  const handleEditorUpdate = useCallback(async (html) => {
    startTyping()
    if (hasDraftContent(html)) {
      commentComposerHadContentRef.current = true
      draftRef.current = html
      saveDraft(html)
      return
    }
    draftRef.current = ''
    // Empty HTML: cancel any pending debounced save (useDraft) then remove server draft if user had content
    saveDraft(html)
    if (commentComposerHadContentRef.current) {
      commentComposerHadContentRef.current = false
      await clearDraft({ deleteOnServer: true })
    }
  }, [saveDraft, clearDraft, startTyping])

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

      // On iOS/iPadOS, the virtual keyboard doesn't shrink the layout viewport,
      // so the comment form can end up hidden behind the keyboard. Scroll it to
      // the bottom of the visual viewport (just above the keyboard) after a
      // delay to let the keyboard finish animating.
      setTimeout(() => {
        const formEl = editor.current?.view?.dom?.closest?.('.CommentForm')
        if (formEl) {
          formEl.scrollIntoView({ behavior: 'smooth', block: 'end' })
        }
      }, 400)
    }
    setIsFocused(true)
  }, [])

  useImperativeHandle(ref, () => ({
    hasUnsavedContent: () => {
      const html = editor.current?.getHTML?.() ?? draftRef.current ?? ''
      if (hasDraftContent(html)) return true
      if (attachments.length > 0) return true
      return false
    },
    flushSaveDraft: async () => {
      const html = editor.current?.getHTML?.() ?? draftRef.current ?? ''
      if (!hasDraftContent(html)) return
      await flushSaveDraft(html, { force: true })
    },
    discardDraft: async () => {
      editor.current?.clearContent?.()
      draftRef.current = ''
      commentComposerHadContentRef.current = false
      await clearDraft()
      clearAttachmentsAction()
    }
  }), [attachments.length, clearAttachmentsAction, clearDraft, flushSaveDraft])

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
        <div className={cn('ml-0 mr-0 w-full min-w-0 cursor-text flex items-center', { [classes.disabled]: !currentUser })}>
          {currentUser
            ? <RoundImage url={currentUser.avatarUrl} small className='w-6 h-6' />
            : <Icon name='Person' className={classes.anonymousImage} dataTestId='icon-Person' />}

          <HyloEditor
            contentHTML={hyloContentHTML}
            onAltEnter={handleSubmit}
            className='w-full cursor-text flex'
            readOnly={!currentUser}
            onUpdate={handleEditorUpdate}
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
})

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
