import React from 'react'
import PropTypes from 'prop-types'
import { useTranslation } from 'react-i18next'
import { TextHelpers } from '@hylo/shared'
import RoundImageRow from 'components/RoundImageRow'
import { isUnread, participantAttributes } from 'store/models/MessageThread'
import { cn } from 'util/index'
import { toRefArray, itemsToArray } from 'util/reduxOrmMigration'
import { lastMessageCreator } from './util'

const MAX_MESSAGE_LENGTH = 145

MessagesDropdownItem.propTypes = {
  currentUser: PropTypes.any,
  onClick: PropTypes.any,
  thread: PropTypes.any
}

export default function MessagesDropdownItem ({ thread, onClick, currentUser }) {
  const { t } = useTranslation()

  if (!thread) return null

  const messages = toRefArray(itemsToArray(thread.messages))
  const message = messages.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))[0]

  if (!message || !message.text) return null

  const participants = toRefArray(thread.participants)
  const { names, avatarUrls } = participantAttributes(thread, currentUser, 2)
  let displayText = lastMessageCreator(message, currentUser, participants, t) + message.text

  displayText = TextHelpers.presentHTMLToText(displayText, { truncate: MAX_MESSAGE_LENGTH })

  return (
    <li className={cn('flex items-start cursor-pointer border-t border-border text-sm text-muted-foreground p-3', { 'bg-primary/20 text-foreground': isUnread(thread) })} onClick={onClick}>
      <div className='my-1 w-10'>
        <RoundImageRow imageUrls={avatarUrls} vertical ascending cap='2' />
      </div>
      <div className='flex flex-col flex-grow align-start px-3 pt-1'>
        <div className={cn('mb-2 font-bold')}>{names}</div>
        <div className='text-sm'>{displayText}</div>
        <div className='text-xs text-muted-foreground/50'>{TextHelpers.humanDate(thread.updatedAt)}</div>
      </div>
    </li>
  )
}
