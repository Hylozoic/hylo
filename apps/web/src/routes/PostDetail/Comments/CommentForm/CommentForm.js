import isMobile from 'ismobilejs'
import React, { useRef, useCallback } from 'react'
import { throttle, isEmpty } from 'lodash/fp'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
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

  const currentUser = useSelector(getMe)
  const attachments = useSelector(state => getAttachments(state, { type: 'comment', id: 'new', attachmentType: 'image' }), (a, b) => a.length === b.length && a.every((item, index) => item.id === b[index].id))
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

  return (
    <>
      <div className={cn('CommentForm flex flex-col items-start justify-between bg-input rounded-lg p-3', className)}>
        <div className={cn(classes.prompt, { [classes.disabled]: !currentUser })}>
          {currentUser
            ? <RoundImage url={currentUser.avatarUrl} small className={classes.image} />
            : <Icon name='Person' className={classes.anonymousImage} dataTestId='icon-Person' />}

          <HyloEditor
            contentHTML={editorContent}
            onAltEnter={handleSubmit}
            className={classes.editor}
            readOnly={!currentUser}
            onUpdate={startTyping}
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
                    onClick={() => handleSubmit(editor.current.getHTML())}
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
      <p className='text-xs text-gray-500 text-end'>
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
