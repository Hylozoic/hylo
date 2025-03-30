import { get } from 'lodash/fp'
import PropTypes from 'prop-types'
import React from 'react'
import { Link } from 'react-router-dom'
import { TextHelpers, DateTimeHelpers } from '@hylo/shared'
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
            <div className={cn('max-w-[200px] w-full')}><ThreadNames names={names} unreadCount={unreadCount} active={active} /></div>
            <div className='text-xs text-foreground opacity-70'>{DateTimeHelpers.humanDate(get('createdAt', latestMessage), true)}</div>
          </div>
          <div className='flex items-center w-full justify-between'>
            <div className={cn('text-sm text-foreground opacity-40 group-hover:opacity-100 break-all leading-4', { 'opacity-100 font-bold': unreadCount > 0 }, { 'opacity-100': active })}>{latestMessagePreview}</div>
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
  return (
    <div className='text-center relative min-w-[62px] h-full justify-center items-center flex min-h-[62px] h-[62px]'>
      {count === 1 && <RoundImage url={avatarUrls[0]} large className='scale-90' />}
      {count === 2 && (
        <div className='w-[60px] h-[60px] bg-black/20 rounded-full text-center items-center flex justify-center gap-1'>
          <RoundImage url={avatarUrls[0]} medium className='inline relative left-1 bottom-1' />
          <RoundImage url={avatarUrls[1]} medium className='inline relative right-1 top-1' />
        </div>
      )}
      {(count > 2 && count < 5) && (
        <div className='w-[60px] h-[60px] bg-black/20 rounded-full text-center items-center flex justify-center gap-1 flex-wrap'>
          <RoundImage url={avatarUrls[0]} small className='inline relative top-1 left-1' />
          <RoundImage url={avatarUrls[1]} medium className='inline relative top-1 right-1' />
          <RoundImage url={avatarUrls[2]} medium className='inline relative bottom-2 left-1' />
          <RoundImage url={avatarUrls[3]} small className='inline relative bottom-1 right-1' />
        </div>
      )}

      {count > 4 && (
        <div className='w-[60px] h-[60px] bg-black/20 rounded-full text-center items-center flex justify-center gap-1 flex-wrap'>
          <RoundImage url={avatarUrls[0]} medium className='inline relative top-1 left-1' />
          <RoundImage url={avatarUrls[1]} small className='inline relative top-1 right-1' />
          <RoundImage url={avatarUrls[2]} small className='inline relative bottom-1 left-1' />
          <div className='bg-black/50 absolute bottom-0 right-0 w-[30px] h-[30px] rounded-full text-foreground text-xs flex items-center justify-center relative bottom-2 right-1'>+{count - 4}</div>
        </div>
      )}
    </div>
  )
}

function ThreadNames ({ names, unreadCount, active }) {
  return <div className={cn('text-foreground/80 font-bold truncate group-hover:text-foreground/100', { 'text-foreground/100': unreadCount > 0 }, { 'text-foreground/100': active })}>{names}</div>
}
