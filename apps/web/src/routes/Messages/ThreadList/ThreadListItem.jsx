import { get } from 'lodash/fp'
import PropTypes from 'prop-types'
import React from 'react'
import { Link } from 'react-router-dom'
import { TextHelpers } from '@hylo/shared'
import Badge from 'components/Badge'
import RoundImage from 'components/RoundImage'
import { participantAttributes } from 'store/models/MessageThread'
import { cn } from 'util/index'

import classes from './ThreadList.module.scss'

const MAX_THREAD_PREVIEW_LENGTH = 60

export default function ThreadListItem ({
  currentUser, active, id, thread, latestMessage, unreadCount, isUnread
}) {
  const latestMessagePreview = TextHelpers.presentHTMLToText(latestMessage?.text, { truncate: MAX_THREAD_PREVIEW_LENGTH })
  const { names, avatarUrls } = participantAttributes(thread, currentUser, 2)

  return (
    <li>
      <Link to={`/messages/${id}`} className={cn('group flex flex-row bg-transparent m-0 p-2 hover:scale-105 transition-all hover:bg-selected/50 max-h-[80px]', { [classes.unreadListItem]: isUnread, 'bg-selected': active })}>
        <div className='mr-2 flex flex-col justify-center'>
          <ThreadAvatars avatarUrls={avatarUrls} />
        </div>
        <div className='w-full flex flex-col justify-center'>
          <div className='flex items-center justify-between w-full'>
            <div className={cn('max-w-[200px] w-full')}><ThreadNames names={names} unreadCount={unreadCount} active={active}/></div>
            <div className='text-xs text-foreground opacity-60'>{TextHelpers.humanDate(get('createdAt', latestMessage), true)}</div>
          </div>
          <div className='flex items-center w-full justify-between'>
            <div className={cn('text-sm text-foreground opacity-40 group-hover:opacity-100 break-all leading-4', { 'opacity-100': unreadCount > 0 }, { 'opacity-100': active })}>{latestMessagePreview}</div>
            <div>{unreadCount > 0 && <Badge number={unreadCount} expanded />}</div>
          </div>
        </div>
      </Link>
    </li>
  )
}

ThreadListItem.propTypes = {
  active: PropTypes.bool,
  currentUser: PropTypes.object,
  id: PropTypes.any,
  latestMessage: PropTypes.shape({
    text: PropTypes.string.isRequired
  }),
  thread: PropTypes.object,
  unreadCount: PropTypes.number
}

function ThreadAvatars ({ avatarUrls }) {
  const count = avatarUrls.length
  const style = `avatar${count < 4 ? count : 'More'}`
  const plusStyle = cn(`avatar${count < 4 ? count : 'More'}`, { [classes.plusCount]: count > 4 })
  return (
    <div className='text-center relative min-w-[62px] h-full justify-center items-center flex min-h-[62px] h-[62px]'>
      {count === 1 && <RoundImage url={avatarUrls[0]} className={classes[style]}/>}
      {count === 2 && <RoundImage url={avatarUrls[0]} medium className={classes[style]}/>}
      {count === 2 && <RoundImage url={avatarUrls[1]} medium className={classes[style]} />}
      {count > 2 && <RoundImage url={avatarUrls[0]} medium className={classes[style]} />}
      {count > 2 && <RoundImage url={avatarUrls[1]} medium className={classes[style]} />}
      {count > 2 && <RoundImage url={avatarUrls[2]} medium className={classes[style]} />}
      {count === 4 && <RoundImage url={avatarUrls[3]} medium className={classes[style]} />}
      {count > 4 && <div className='bg-black/50 absolute bottom-0 right-0 w-[30px] h-[30px] rounded-full text-foreground text-xs flex items-center justify-center'>+{count - 4}</div>}
    </div>
  )
}

function ThreadNames ({ names, unreadCount, active }) {
  return <div className={cn('text-foreground/70 font-bold truncate group-hover:text-foreground/100', { 'text-foreground/100': unreadCount > 0 }, { 'text-foreground/100': active })}>{names}</div>
}
