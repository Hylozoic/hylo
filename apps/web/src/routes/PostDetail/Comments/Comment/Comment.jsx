import { cn } from 'util/index'
import React, { useCallback } from 'react'
import { Link, useParams } from 'react-router-dom'
import { filter, isFunction, isEmpty } from 'lodash/fp'
import { useTranslation } from 'react-i18next'
import { TextHelpers, DateTimeHelpers } from '@hylo/shared'
import { personUrl } from 'util/navigation'
import scrollIntoView from 'scroll-into-view-if-needed'
import Avatar from 'components/Avatar'
import ClickCatcher from 'components/ClickCatcher'
import CardFileAttachments from 'components/CardFileAttachments'
import CardImageAttachments from 'components/CardImageAttachments'
import CommentForm from '../CommentForm'
import EmojiRow from 'components/EmojiRow'
import HyloEditor from 'components/HyloEditor'
import HyloHTML from 'components/HyloHTML/HyloHTML'
import Icon from 'components/Icon'
import ShowMore from '../ShowMore'
import Tooltip from 'components/Tooltip'
import styles from './Comment.module.scss'
import { useDispatch, useSelector } from 'react-redux'
import getGroupForSlug from 'store/selectors/getGroupForSlug'
import createComment from 'store/actions/createComment'
import updateComment from 'store/actions/updateComment'
import deleteComment from 'store/actions/deleteComment'
import fetchChildComments from 'store/actions/fetchChildComments'
import { getHasMoreChildComments, getTotalChildComments } from 'store/selectors/getChildComments'
import getMe from 'store/selectors/getMe'
import getResponsibilitiesForGroup from 'store/selectors/getResponsibilitiesForGroup'
import { RESP_MANAGE_CONTENT } from 'store/constants'
import { INITIAL_SUBCOMMENTS_DISPLAYED } from 'util/constants'
import { getLocaleFromLocalStorage } from 'util/locale'

function Comment ({
  comment,
  onReplyComment,
  selectedCommentId,
  slug,
  post
}) {
  const { t } = useTranslation()
  const dispatch = useDispatch()
  const routeParams = useParams()
  const commentRef = React.useRef()
  const editor = React.useRef()
  const [edited, setEdited] = React.useState(false)
  const [editing, setEditing] = React.useState(false)
  const [showActions, setShowActions] = React.useState(false)
  const [isEmojiPickerOpen, setIsEmojiPickerOpen] = React.useState(false)

  const currentUser = useSelector(state => getMe(state))
  const group = useSelector(state => getGroupForSlug(state, routeParams.groupSlug))
  const responsibilities = useSelector(state =>
    getResponsibilitiesForGroup(state, { person: currentUser, groupId: group?.id })
  ).map(r => r.title)
  const canModerate = currentUser && responsibilities && responsibilities.includes(RESP_MANAGE_CONTENT)

  React.useEffect(() => {
    if (selectedCommentId === comment.id) {
      setTimeout(handleScrollToComment, 500)
    }
  }, [selectedCommentId, comment.id])

  const deleteCommentWithConfirm = useCallback((commentId, text) => {
    return window.confirm(text) && dispatch(deleteComment(commentId))
  }, [])

  const handleEditComment = useCallback(() => {
    setEditing(true)
  }, [])

  const handleEditCancel = useCallback(() => {
    setEditing(false)
    editor.current.setContent(comment.text)
    return true
  }, [])

  const handleEditSave = contentHTML => {
    if (editor?.current && editor.current.isEmpty()) {
      return true
    }
    dispatch(updateComment(comment.id, contentHTML))
    setEditing(false)
    setEdited(true)
    return true
  }

  const handleScrollToComment = useCallback(() => {
    if (commentRef.current) {
      const { bottom, top } = commentRef.current.getBoundingClientRect()
      const viewportHeight = window.innerHeight || document.documentElement.clientHeight

      if (bottom < 0 || bottom > viewportHeight || top < 0) {
        scrollIntoView(commentRef.current, { block: 'center' })
      }
    }
  }, [])

  const handleEmojiPickerOpen = useCallback((isOpen) => {
    setIsEmojiPickerOpen(isOpen)
    setShowActions(isOpen)
  }, [])

  const { id, creator, createdAt, editedAt, text, attachments } = comment
  const timestamp = DateTimeHelpers.humanDate(createdAt)
  const editedTimestamp = (editedAt || edited) ? t('edited') + ' ' + DateTimeHelpers.humanDate(editedAt) : false
  const isCreator = currentUser && (comment.creator.id === currentUser.id)
  const profileUrl = personUrl(creator.id, slug)
  const dropdownItems = filter(item => isFunction(item.onClick), [
    {},
    { icon: 'Edit', label: 'Edit', onClick: isCreator && handleEditComment },
    { icon: 'Trash', label: 'Delete', onClick: isCreator ? () => deleteCommentWithConfirm(comment.id, t('Are you sure you want to delete this comment')) : null },
    { icon: 'Trash', label: 'Remove', onClick: !isCreator && canModerate ? () => deleteCommentWithConfirm(comment.id, t('Are you sure you want to remove this comment?')) : null }
  ])

  return (
    <div
      ref={commentRef}
      className={cn('commentContainer px-4 pb-2', { [styles.selectedComment]: selectedCommentId === comment.id })}
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => { if (!isEmojiPickerOpen) { setShowActions(false) } }}
    >
      <div className='flex flex-row items-center justify-between w-full'>
        <div className='flex flex-row items-center'>
          <Avatar avatarUrl={creator.avatarUrl} url={profileUrl} medium />
          <Link to={profileUrl} className='text-sm font-bold ml-2 text-foreground'>{creator.name}</Link>
        </div>
        <div>
          <span className='text-xs text-foreground/50 pl-2' data-tooltip-id={`dateTip-${comment.id}`} data-tooltip-content={DateTimeHelpers.toDateTime(createdAt, { locale: getLocaleFromLocalStorage() }).toFormat('D t ZZZZ')}>
            {timestamp}
          </span>
          {(editedTimestamp) && (
            <span className={styles.timestamp} data-tooltip-id={`dateTip-${comment.id}`} data-tooltip-content={DateTimeHelpers.toDateTime(editedAt, { locale: getLocaleFromLocalStorage() }).toFormat('D t ZZZZ')}>
              ({editedTimestamp})
            </span>
          )}
        </div>
        <div className={styles.upperRight}>
          {editing && (
            <Icon name='Ex' className={styles.cancelIcon} onClick={handleEditCancel} />
          )}
          {currentUser && (
            <div className={cn(styles.commentActions, { [styles.showActions]: showActions })}>
              <div className={cn(styles.commentAction)} onClick={onReplyComment} data-tooltip-content='Reply' data-tooltip-id={`reply-tip-${id}`}>
                <Icon name='Replies' />
              </div>
              {dropdownItems.map(item => (
                <div key={item.icon} className={styles.commentAction} onClick={item.onClick}>
                  <Icon name={item.icon} dataTestId={item.label} />
                </div>
              ))}
              <EmojiRow
                className={cn(styles.emojis, styles.hiddenReactions)}
                comment={comment}
                currentUser={currentUser}
                post={post}
                onOpenChange={handleEmojiPickerOpen}
              />
            </div>
          )}
        </div>
      </div>
      {attachments &&
        <div>
          <CardImageAttachments attachments={attachments} linked className={styles.images} />
          <CardFileAttachments attachments={attachments} className={styles.files} />
        </div>}
      {editing && (
        <HyloEditor
          className={styles.editing}
          contentHTML={text}
          onEscape={handleEditCancel}
          onEnter={handleEditSave}
          ref={editor}
        />
      )}
      {!editing && (
        <>
          <ClickCatcher groupSlug={slug}>
            <HyloHTML className={cn('ml-[36px]', styles.text)} html={text} />
          </ClickCatcher>
          <EmojiRow
            className={cn(styles.emojis, { [styles.noEmojis]: !comment.commentReactions || comment.commentReactions.length === 0 })}
            comment={comment}
            currentUser={currentUser}
            post={post}
          />
        </>
      )}
    </div>
  )
}

export default function CommentWithReplies (props) {
  const { t } = useTranslation()
  const dispatch = useDispatch()
  const { comment, post, onReplyThread } = props
  const childCommentsTotal = useSelector(state => getTotalChildComments(state, { id: comment.id }))
  const hasMoreChildComments = useSelector(state => getHasMoreChildComments(state, { id: comment.id }))

  const [replying, setReplying] = React.useState(false)
  const [triggerReplyAction, setTriggerReplyAction] = React.useState(false)
  const [prefillEditor, setPrefillEditor] = React.useState(null)
  const [showLatestOnly, setShowLatestOnly] = React.useState(true)
  const [newCommentsAdded, setNewCommentsAdded] = React.useState(0)

  const replyBox = React.useRef()

  const onReplyComment = (e, toMember) => {
    setReplying(true)
    setTriggerReplyAction(true)
    setPrefillEditor(toMember
      ? `<p>${TextHelpers.mentionHTML(toMember)}&nbsp;</p>`
      : '')
  }

  React.useEffect(() => {
    if (onReplyThread && triggerReplyAction && replyBox.current) {
      onReplyThread(replyBox.current)
      setTriggerReplyAction(false)
    }
  }, [triggerReplyAction])

  const cursor = !isEmpty(comment.childComments) && comment.childComments[0].id
  const fetchChildCommentsHandler = useCallback(() => {
    setShowLatestOnly(false)
    dispatch(fetchChildComments(comment.id, { cursor }))
  }, [comment.id, cursor, dispatch])

  const createCommentHandler = React.useCallback((commentParams) => {
    return dispatch(createComment({
      post,
      parentCommentId: comment.id,
      ...commentParams
    })).then(() => {
      setNewCommentsAdded(prev => prev + 1)
    })
  }, [comment.id, post, dispatch])

  let childComments = comment.childComments

  if (showLatestOnly) {
    childComments = childComments.slice(-1 * (INITIAL_SUBCOMMENTS_DISPLAYED + newCommentsAdded))
  }

  return (
    <div className='commentContainer px-4 pb-2'>
      <Comment {...props} onReplyComment={onReplyComment} />
      {childComments && (
        <div className='ml-6'>
          <div className={styles.moreWrap}>
            <ShowMore
              commentsLength={childComments.length}
              total={childCommentsTotal + newCommentsAdded}
              hasMore={hasMoreChildComments}
              fetchComments={fetchChildCommentsHandler}
            />
          </div>
          {childComments.map(c => (
            <Comment
              key={c.id}
              {...props}
              comment={c}
              onReplyComment={(e) => onReplyComment(e, c.creator)}
            />
          ))}
        </div>
      )}
      {replying && (
        <div className={styles.replybox} ref={replyBox}>
          <CommentForm
            createComment={createCommentHandler}
            placeholder={`${t('Reply to')} ${comment.creator.name}`}
            editorContent={prefillEditor}
            focusOnRender
          />
        </div>
      )}
      <Tooltip id={`reply-tip-${comment.id}`} />
      <Tooltip
        delay={550}
        id={`dateTip-${comment.id}`}
        position='left'
      />
    </div>
  )
}
