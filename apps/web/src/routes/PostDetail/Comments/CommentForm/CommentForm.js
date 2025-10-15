import React, { useRef, useCallback, useEffect, useMemo } from 'react'
import { throttle, isEmpty } from 'lodash/fp'
import PropTypes from 'prop-types'
import { useTranslation } from 'react-i18next'
import { Link, useLocation } from 'react-router-dom'
import { SendHorizontal } from 'lucide-react'
import { sendIsTyping } from 'client/websockets'
import AttachmentManager from 'components/AttachmentManager'
import { addAttachment, getAttachments, clearAttachments } from 'components/AttachmentManager/AttachmentManager.store'
import Button from 'components/Button'
import HyloEditor from 'components/HyloEditor'
import Icon from 'components/Icon'
import Loading from 'components/Loading'
import RoundImage from 'components/RoundImage'
import Tooltip from 'components/Tooltip'
import UploadAttachmentButton from 'components/UploadAttachmentButton'
import getMe from 'store/selectors/getMe'
import { cn, inIframe } from 'util/index'
import { STARTED_TYPING_INTERVAL } from 'util/constants'
import { useSelector, useDispatch } from 'react-redux'
import useDraftStorage, { hasDraftContent } from 'hooks/useDraftStorage'

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
  const location = useLocation()
  const { pathname, search } = location

  const draftStorageKey = useMemo(() => `draft:comment:${pathname}${search}:post:${postId}`, [pathname, search, postId])
  const { loadDraft, saveDraft, clearDraft } = useDraftStorage(draftStorageKey)
  const draftRef = useRef(editorContent || loadDraft())

  const currentUser = useSelector(getMe)
  const attachments = useSelector(state => getAttachments(state, { type: 'comment', id: 'new', attachmentType: 'image' }), (a, b) => a.length === b.length && a.every((item, index) => item.id === b[index].id))
  const sendIsTypingAction = useCallback((isTyping) => sendIsTyping(postId, isTyping), [postId])
  const addAttachmentAction = useCallback(attachment => dispatch(addAttachment('comment', 'new', attachment)), [dispatch])
  const clearAttachmentsAction = useCallback(() => dispatch(clearAttachments('comment')), [dispatch])

  useEffect(() => {
    const draft = editorContent || loadDraft() || ''
    draftRef.current = draft
    if (editor.current) {
      editor.current.setContent(draft)
    }
  }, [editorContent, loadDraft, postId])

  const startTyping = useCallback(throttle(STARTED_TYPING_INTERVAL, () => {
    sendIsTypingAction(true)
  }), [])

  const handleOnEnter = useCallback(contentHTML => {
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
    clearDraft()

    return true
  }, [attachments, clearAttachmentsAction, clearDraft, createComment, sendIsTypingAction, startTyping])

  const handleEditorUpdate = useCallback((html) => {
    startTyping()
    if (hasDraftContent(html)) {
      draftRef.current = html
      saveDraft(html)
    } else {
      draftRef.current = ''
      clearDraft()
    }
  }, [clearDraft, saveDraft, startTyping])

  const placeholderText = placeholder || t('Add a comment...')

  return (
    <div className={cn('flex flex-col items-center justify-between bg-input rounded-lg p-2', className)}>
      <div className={cn(classes.prompt, { [classes.disabled]: !currentUser })}>
        {currentUser
          ? <RoundImage url={currentUser.avatarUrl} small className={classes.image} />
          : <Icon name='Person' className={classes.anonymousImage} dataTestId='icon-Person' />}

        <HyloEditor
          contentHTML={editorContent ?? draftRef.current}
          onEnter={handleOnEnter}
          className={classes.editor}
          readOnly={!currentUser}
          onUpdate={handleEditorUpdate}
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
            <>
              <div className={classes.sendMessageContainer}>
                <Button
                  borderRadius='6px'
                  onClick={() => handleOnEnter(editor.current.getHTML())}
                  className={classes.sendMessageButton}
                  dataTip={t('You need to include text to post a comment')}
                  dataFor='comment-submit-tt'
                  name='send'
                >
                  <SendHorizontal size={18} color='white' />
                </Button>
                <Tooltip
                  delay={150}
                  position='top'
                  id='comment-submit-tt'
                />
              </div>
              <UploadAttachmentButton
                type='comment'
                id='new'
                allowMultiple
                onSuccess={addAttachmentAction}
                customRender={renderProps => (
                  <UploadButton {...renderProps} className={classes.uploadButton} />
                )}
              />
            </>
            )}
      </div>
      {currentUser && (
        <AttachmentManager type='comment' id='new' attachmentType='image' />
      )}
    </div>
  )
}

CommentForm.propTypes = {
  createComment: PropTypes.func.isRequired,
  className: PropTypes.string,
  placeholder: PropTypes.string,
  editorContent: PropTypes.string
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
