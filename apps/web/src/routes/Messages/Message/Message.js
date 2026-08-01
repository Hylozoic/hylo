import { cn } from 'util/index'
import { Check, Pencil, X } from 'lucide-react'
import PropTypes from 'prop-types'
import React, { useCallback, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useDispatch, useSelector } from 'react-redux'
import TextareaAutosize from 'react-textarea-autosize'
import Avatar from 'components/Avatar'
import ClickCatcher from 'components/ClickCatcher'
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
  const [editing, setEditing] = useState(false)
  const [editText, setEditText] = useState(message.text)
  const [showActions, setShowActions] = useState(false)

  const person = message.creator
  const pending = message.id.slice(0, 13) === 'messageThread'
  const isCreator = currentUser && person?.id === currentUser.id
  const canEdit = isCreator && !pending

  const text = pending
    ? 'sending...'
    : TextHelpers.markdown(message.text)

  const editedTimestamp = message.editedAt
    ? `${t('edited')} ${DateTimeHelpers.humanDate(message.editedAt)}`
    : null

  const handleEdit = useCallback(() => {
    setEditText(message.text)
    setEditing(true)
    setShowActions(false)
  }, [message.text])

  const handleCancelEdit = useCallback(() => {
    if (editText !== message.text && !window.confirm(t('Do you want to discard your edit?'))) {
      return
    }
    setEditText(message.text)
    setEditing(false)
  }, [editText, message.text, t])

  const handleSaveEdit = useCallback(() => {
    const trimmed = editText.trim()
    if (!trimmed) return
    if (trimmed === message.text) {
      setEditing(false)
      return
    }
    dispatch(updateComment(message.id, trimmed))
    setEditing(false)
  }, [dispatch, editText, message.id, message.text])

  const handleEditKeyDown = useCallback((event) => {
    if (event.key === 'Escape') {
      event.preventDefault()
      handleCancelEdit()
    }
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      handleSaveEdit()
    }
  }, [handleCancelEdit, handleSaveEdit])

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
              <div className='text-foreground font-bold -mb-2 truncate hover:underline'>{person.name}</div>
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
              <div className='flex flex-col gap-2'>
                <TextareaAutosize
                  value={editText}
                  onChange={e => setEditText(e.target.value)}
                  onKeyDown={handleEditKeyDown}
                  className='text-foreground bg-background w-full p-2 border border-foreground/20 rounded-lg focus:outline-none focus:border-focus resize-none'
                  minRows={2}
                  maxRows={8}
                  autoFocus
                />
                <div className='flex gap-2 justify-end'>
                  <button
                    type='button'
                    onClick={handleCancelEdit}
                    aria-label={t('Cancel')}
                    className='p-1.5 rounded text-foreground/60 hover:text-foreground hover:bg-foreground/10'
                  >
                    <X className='w-4 h-4' />
                  </button>
                  <button
                    type='button'
                    onClick={handleSaveEdit}
                    aria-label={t('Save')}
                    disabled={!editText.trim()}
                    className='p-1.5 rounded text-primary hover:bg-primary/10 disabled:opacity-40'
                  >
                    <Check className='w-4 h-4' />
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
                  <HyloHTML element='div' className='break-words max-w-full' html={text} />
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
