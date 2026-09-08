import { cn } from 'util/index'
import { Check, Pencil, X } from 'lucide-react'
import PropTypes from 'prop-types'
import React, { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useDispatch, useSelector } from 'react-redux'
import Avatar from 'components/Avatar'
import ClickCatcher from 'components/ClickCatcher'
import CardFileAttachments from 'components/CardFileAttachments'
import CardImageAttachments from 'components/CardImageAttachments'
import HyloEditor from 'components/HyloEditor'
import HyloHTML from 'components/HyloHTML'
import ProfileCardDialog from 'components/ProfileCardDialog/ProfileCardDialog'
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
  const [showActions, setShowActions] = useState(false)

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

  const handleEdit = useCallback(() => {
    setEditing(true)
    setShowActions(false)
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
      className={cn('text-foreground w-full min-w-0 flex pr-3 group', { 'pt-2': isHeader })}
      data-message-id={message.id}
      onMouseEnter={() => { if (!editing) setShowActions(true) }}
      onMouseLeave={() => setShowActions(false)}
    >
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
              {canEdit && !editing && (
                <button
                  type='button'
                  onClick={handleEdit}
                  aria-label={t('Edit')}
                  className={cn(
                    'p-1 rounded text-foreground/40 hover:text-foreground transition-opacity',
                    showActions ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                  )}
                >
                  <Pencil className='w-3.5 h-3.5' />
                </button>
              )}
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
                {!isHeader && canEdit && (
                  <button
                    type='button'
                    onClick={handleEdit}
                    aria-label={t('Edit')}
                    className={cn(
                      'float-right ml-2 p-1 rounded text-foreground/40 hover:text-foreground transition-opacity',
                      showActions ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                    )}
                  >
                    <Pencil className='w-3.5 h-3.5' />
                  </button>
                )}
                <ClickCatcher>
                  {attachments.length > 0 && (
                    <>
                      <CardImageAttachments attachments={attachments} linked className={cn('mb-2', isHeader && 'mt-2')} />
                      <CardFileAttachments attachments={attachments} className='mb-2' />
                    </>
                  )}
                  {text && (
                    <HyloHTML element='div' className='break-words max-w-full' html={text} />
                  )}
                </ClickCatcher>
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
    creator: PropTypes.object
  }).isRequired,
  isHeader: PropTypes.bool
}
