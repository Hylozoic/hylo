import { cn } from 'util/index'
import { Check, Pencil, X } from 'lucide-react'
import PropTypes from 'prop-types'
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useDispatch, useSelector } from 'react-redux'
import Avatar from 'components/Avatar'
import ClickCatcher from 'components/ClickCatcher'
import CardFileAttachments from 'components/CardFileAttachments'
import CardImageAttachments from 'components/CardImageAttachments'
import EmojiPicker from 'components/EmojiPicker'
import EmojiRow from 'components/EmojiRow'
import HyloEditor from 'components/HyloEditor'
import HyloHTML from 'components/HyloHTML'
import ProfileCardDialog from 'components/ProfileCardDialog/ProfileCardDialog'
import useReactionActions from 'hooks/useReactionActions'
import { TextHelpers, DateTimeHelpers } from '@hylo/shared'
import updateComment from 'store/actions/updateComment'
import getMe from 'store/selectors/getMe'
import classes from './Message.module.scss'

export default function Message ({ message, isHeader }) {
  const { t } = useTranslation()
  const dispatch = useDispatch()
  const currentUser = useSelector(getMe)
  const editorRef = useRef()
  const [editing, setEditing] = useState(false)
  const [isHovered, setIsHovered] = useState(false)
  const [isEmojiPickerOpen, setIsEmojiPickerOpen] = useState(false)
  const { reactOnEntity, removeReactOnEntity } = useReactionActions()

  const person = message.creator
  const pending = message.id.slice(0, 13) === 'messageThread'
  const isCreator = currentUser && person?.id === currentUser.id
  const canEdit = isCreator && !pending
  const attachments = message.attachments?.toRefArray
    ? message.attachments.toRefArray()
    : (message.attachments || [])

  const text = pending
    ? 'sending...'
    : message.text ? TextHelpers.markdown(message.text) : ''

  const editedTimestamp = message.editedAt
    ? `${t('edited')} ${DateTimeHelpers.humanDate(message.editedAt)}`
    : null

  useEffect(() => {
    if (!editing) return
    const id = setTimeout(() => editorRef.current?.focus('end'), 100)
    return () => clearTimeout(id)
  }, [editing])

  const handleEdit = useCallback((event) => {
    event?.stopPropagation()
    setIsHovered(false)
    setEditing(true)
  }, [])

  const myEmojis = useMemo(() => (
    message.commentReactions
      ? message.commentReactions.filter(reaction => reaction.user?.id === currentUser?.id).map(reaction => reaction.emojiFull)
      : []
  ), [message.commentReactions, currentUser])

  const hasReactions = (message.commentReactions || []).length > 0

  const handleReaction = useCallback((emojiFull) => {
    reactOnEntity({ commentId: message.id, emojiFull, entityType: 'comment', postId: message.id, groupIds: [] })
  }, [message.id, reactOnEntity])

  const handleRemoveReaction = useCallback((emojiFull) => {
    removeReactOnEntity({ commentId: message.id, emojiFull, entityType: 'comment', postId: message.id })
  }, [message.id, removeReactOnEntity])

  const handleMouseEnter = useCallback(() => {
    if (!editing) setIsHovered(true)
  }, [editing])

  const handleMouseLeave = useCallback(() => {
    if (!isEmojiPickerOpen) setIsHovered(false)
  }, [isEmojiPickerOpen])

  const handleEmojiPickerOpen = useCallback((isOpen) => {
    setIsEmojiPickerOpen(isOpen)
    setIsHovered(isOpen)
  }, [])

  const discardEdit = useCallback(() => {
    editorRef.current?.setContent(message.text)
    setEditing(false)
  }, [message.text])

  const handleEditCancel = useCallback(() => {
    discardEdit()
    return true
  }, [discardEdit])

  const handleEditCancelClick = useCallback((event) => {
    event.stopPropagation()
    if (window.confirm(t('Do you want to discard your edit?'))) {
      discardEdit()
    }
  }, [discardEdit, t])

  const handleEditSave = useCallback(contentHTML => {
    if (editorRef.current?.isEmpty()) {
      return true
    }
    dispatch(updateComment(message.id, contentHTML))
    setEditing(false)
    return true
  }, [dispatch, message.id])

  const handleEditSaveClick = useCallback((event) => {
    event.stopPropagation()
    if (editorRef.current) {
      handleEditSave(editorRef.current.getHTML())
    }
  }, [handleEditSave])

  return (
    <div
      className={cn(
        'text-foreground w-full min-w-0 flex pr-3 relative rounded-lg transition-all border-2 border-transparent py-1 -my-1 pb-[1px] pt-1',
        { 'mt-2': isHeader, 'bg-card shadow-lg': isHovered && !editing }
      )}
      data-message-id={message.id}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {!pending && !editing && (
        <div
          className={cn(
            'flex p-1 gap-2 absolute z-10 right-1 top-0 transition-all rounded-lg bg-background/100 dark:bg-darkening opacity-0 delay-100 scale-0 pointer-events-none',
            { 'opacity-100 scale-102 pointer-events-auto': isHovered },
            '[@media(hover:none)]:opacity-100 [@media(hover:none)]:scale-100 [@media(hover:none)]:pointer-events-auto'
          )}
        >
          {canEdit && (
            <button
              type='button'
              onClick={handleEdit}
              aria-label={t('Edit')}
              className='w-6 h-6 flex justify-center items-center rounded-lg bg-card hover:scale-110 transition-all border-2 border-transparent hover:border-foreground/50 shadow-lg hover:cursor-pointer'
            >
              <Pencil className='w-4 h-4 text-foreground' />
            </button>
          )}
          <EmojiPicker
            className='w-6 h-6 flex justify-center items-center rounded-lg bg-card border-2 border-transparent hover:border-foreground/50 transition-all shadow-lg hover:cursor-pointer'
            handleReaction={handleReaction}
            handleRemoveReaction={handleRemoveReaction}
            myEmojis={myEmojis}
            onOpenChange={handleEmojiPickerOpen}
          />
        </div>
      )}
      <div className={classes.avatar}>
        {isHeader && (
          <ProfileCardDialog personId={person.id}>
            <Avatar avatarUrl={person.avatarUrl} />
          </ProfileCardDialog>
        )}
      </div>
      <div className={cn(classes.content, 'min-w-0')}>
        {isHeader && (
          <div className='flex justify-between items-center gap-2'>
            <ProfileCardDialog personId={person.id}>
              <div className='text-foreground font-bold truncate hover:underline'>{person.name}</div>
            </ProfileCardDialog>
            <div className='flex items-center gap-1 flex-shrink-0'>
              <span className='text-xs text-foreground/50 whitespace-nowrap'>
                {pending ? 'sending...' : TextHelpers.humanDate(message.createdAt)}
                {editedTimestamp && (
                  <span className='ml-1'>({editedTimestamp})</span>
                )}
              </span>
            </div>
          </div>
        )}
        {!isHeader && editedTimestamp && (
          <div className='text-xs text-foreground/50 text-right mb-0.5'>({editedTimestamp})</div>
        )}
        <div className='text-foreground break-words'>
          {editing
            ? (
              <div className='relative'>
                <HyloEditor
                  className='py-2.5 pr-[50px] pl-2.5 m-0 overflow-y-auto max-h-[200px] cursor-text border border-foreground/20 rounded-lg'
                  contentHTML={message.text}
                  onEscape={handleEditCancel}
                  onEnter={handleEditSave}
                  blurOnScroll={false}
                  ref={editorRef}
                />
                <div className='absolute top-2.5 right-2.5 flex items-center gap-1.5 z-[1]'>
                  <button
                    type='button'
                    onClick={handleEditSaveClick}
                    aria-label={t('Save')}
                    data-testid='Save'
                    className='p-0.5 rounded text-selected hover:bg-selected/10'
                  >
                    <Check className='w-5 h-5' />
                  </button>
                  <button
                    type='button'
                    onClick={handleEditCancelClick}
                    aria-label={t('Cancel')}
                    data-testid='Cancel'
                    className='p-0.5 rounded text-destructive hover:bg-destructive/10'
                  >
                    <X className='w-5 h-5' />
                  </button>
                </div>
              </div>
              )
            : (
              <>
                <ClickCatcher>
                  {attachments.length > 0 && (
                    <>
                      <CardImageAttachments attachments={attachments} linked className={cn('mb-2', isHeader && 'mt-2')} />
                      <CardFileAttachments attachments={attachments} className='mb-2' />
                    </>
                  )}
                  {text && (
                    <HyloHTML element='div' className='break-words max-w-full [&>*:first-child]:mt-0 [&>*:last-child]:mb-0' html={text} />
                  )}
                </ClickCatcher>
                {hasReactions && (
                  <div className='mt-1'>
                    <EmojiRow
                      className='!mr-0'
                      pillClassName='m-0 mr-1 mb-0 py-0.5 px-2 h-[26px] rounded-full text-xs items-center'
                      post={message}
                      comment={message}
                      currentUser={currentUser}
                      onOpenChange={handleEmojiPickerOpen}
                    />
                  </div>
                )}
              </>
              )}
        </div>
      </div>
    </div>
  )
}

Message.propTypes = {
  message: PropTypes.shape({
    id: PropTypes.string,
    text: PropTypes.string,
    createdAt: PropTypes.string,
    editedAt: PropTypes.string,
    creator: PropTypes.object,
    commentReactions: PropTypes.array
  }).isRequired,
  isHeader: PropTypes.bool
}
