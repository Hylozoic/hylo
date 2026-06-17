import { get } from 'lodash/fp'
import { Mail, MailOpen } from 'lucide-react'
import PropTypes from 'prop-types'
import React, { useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { TextHelpers } from '@hylo/shared'
import Badge from 'components/Badge'
import RoundImage from 'components/RoundImage'
import { participantAttributes } from 'store/models/MessageThread'
import { cn } from 'util/index'
import { isPhoneDevice } from 'util/mobile'
import { useDispatch } from 'react-redux'
import { toggleNavMenu } from 'routes/AuthLayoutRouter/AuthLayoutRouter.store'
import { markThreadUnread, updateThreadReadTime } from '../Messages.store'

import classes from './ThreadList.module.scss'

const MAX_THREAD_PREVIEW_LENGTH = 60

export default function ThreadListItem ({
  currentUser, active, id, thread, latestMessage, unreadCount, isUnread
}) {
  const { t } = useTranslation()
  const latestMessagePreview = TextHelpers.presentHTMLToText(latestMessage?.text, { truncate: MAX_THREAD_PREVIEW_LENGTH })
  const { names, avatarUrls } = participantAttributes(thread, currentUser, 2)
  const dispatch = useDispatch()
  const toggleNavMenuAction = useCallback(() => dispatch(toggleNavMenu()), [])
  const handleToggleReadStatus = useCallback((event) => {
    event.preventDefault()
    event.stopPropagation()
    if (isUnread) {
      dispatch(updateThreadReadTime(id))
    } else {
      dispatch(markThreadUnread(id))
    }
  }, [dispatch, id, isUnread])

  return (
    <li className={cn('group flex flex-row items-stretch bg-transparent m-0 hover:scale-[1.02] transition-all hover:bg-selected/50', { [classes.unreadListItem]: isUnread, 'bg-transparent xs:bg-selected': active })}>
      <Link to={`/messages/${id}`} className='flex flex-row flex-1 min-w-0 p-2' onClick={isPhoneDevice() ? toggleNavMenuAction : undefined}>
        <div className='mr-2 flex flex-col justify-center flex-shrink-0'>
          <ThreadAvatars avatarUrls={avatarUrls} />
        </div>
        <div className='w-full flex flex-col justify-center min-w-0'>
          <div className='w-full flex-shrink-0'>
            <ThreadNames names={names} unreadCount={unreadCount} active={active} />
          </div>
          <div className='text-xs text-foreground opacity-70 mb-2 flex-shrink-0'>{TextHelpers.humanDate(get('createdAt', latestMessage), true)}</div>
          <div className={cn('text-sm text-foreground opacity-40 group-hover:opacity-100 leading-4 min-w-0 overflow-hidden', { 'opacity-100 font-bold': unreadCount > 0 }, { 'opacity-100': active })}>
            <div className='line-clamp-2 break-words'>{latestMessagePreview}</div>
          </div>
        </div>
      </Link>
      <div className='flex flex-col items-center justify-center flex-shrink-0 gap-1 pr-2 py-2'>
        {unreadCount > 0 && <Badge number={unreadCount} expanded />}
        <button
          type='button'
          onClick={handleToggleReadStatus}
          aria-label={isUnread ? t('Mark as read') : t('Mark as unread')}
          title={isUnread ? t('Mark as read') : t('Mark as unread')}
          className={cn(
            'flex items-center justify-center w-9 h-9 rounded-lg transition-all scale-100 hover:scale-105',
            'bg-darkening/20 hover:bg-selected/80 text-foreground/60 hover:text-foreground',
            { 'text-foreground': isUnread }
          )}
        >
          {isUnread ? <MailOpen className='w-4 h-4' /> : <Mail className='w-4 h-4' />}
        </button>
      </div>
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
        <div className='w-[60px] h-[60px] bg-darkening/20 rounded-full text-center items-center flex justify-center gap-1'>
          <RoundImage url={avatarUrls[0]} medium className='inline relative left-1 bottom-1' />
          <RoundImage url={avatarUrls[1]} medium className='inline relative right-1 top-1' />
        </div>
      )}
      {(count > 2 && count < 5) && (
        <div className='w-[60px] h-[60px] bg-darkening/20 rounded-full text-center items-center flex justify-center gap-1 flex-wrap'>
          <RoundImage url={avatarUrls[0]} small className='inline relative top-1 left-1' />
          <RoundImage url={avatarUrls[1]} medium className='inline relative top-1 right-1' />
          <RoundImage url={avatarUrls[2]} medium className='inline relative bottom-2 left-1' />
          <RoundImage url={avatarUrls[3]} small className='inline relative bottom-1 right-1' />
        </div>
      )}

      {count > 4 && (
        <div className='w-[60px] h-[60px] bg-darkening/20 rounded-full text-center items-center flex justify-center gap-1 flex-wrap'>
          <RoundImage url={avatarUrls[0]} medium className='inline relative top-1 left-1' />
          <RoundImage url={avatarUrls[1]} small className='inline relative top-1 right-1' />
          <RoundImage url={avatarUrls[2]} small className='inline relative bottom-1 left-1' />
          <div className='bg-darkening/50 absolute bottom-0 right-0 w-[30px] h-[30px] rounded-full text-foreground text-xs flex items-center justify-center relative bottom-2 right-1'>+{count - 4}</div>
        </div>
      )}
    </div>
  )
}

function ThreadNames ({ names, unreadCount, active }) {
  return <div className={cn('text-foreground/80 font-bold truncate group-hover:text-foreground/100 w-full', { 'text-foreground/100': unreadCount > 0 }, { 'text-foreground/100': active })}>{names}</div>
}
