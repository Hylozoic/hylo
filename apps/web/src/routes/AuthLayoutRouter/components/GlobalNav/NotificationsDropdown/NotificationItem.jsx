import { cn } from 'util/index'
import React from 'react'
import { useTranslation } from 'react-i18next'
import { useDispatch } from 'react-redux'
import { TextHelpers } from '@hylo/shared'
import RoundImage from 'components/RoundImage'
import { bodyForNotification, titleForNotification, imageForNotification } from '@hylo/presenters/NotificationPresenter'
import { isMobileDevice } from 'util/mobile'
import { toggleNavMenu } from 'routes/AuthLayoutRouter/AuthLayoutRouter.store'

export default function NotificationItem ({ notification, onClick }) {
  const { activity: { unread } } = notification
  const { t } = useTranslation()
  const dispatch = useDispatch()

  const handleClick = (event) => {
    event.stopPropagation()
    // Close context menu on mobile when notification is clicked
    if (isMobileDevice()) {
      dispatch(toggleNavMenu(false))
    }
    onClick(event, notification)
  }

  const handleTouchStart = (event) => {
    event.stopPropagation()
  }

  const handleTouchEnd = (event) => {
    event.stopPropagation()
  }

  return (
    <li
      className={cn('flex items-start cursor-pointer border-b border-border text-sm text-muted-foreground py-3 bg-darkening/10 opacity-80 hover:opacity-100 transition-all', { 'bg-white/10 opacity-100 text-foreground': unread })}
      onClick={handleClick}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      <div className='my-1 pl-3'>
        <RoundImage url={imageForNotification(notification)} medium />
      </div>
      <div className='flex flex-col align-start px-3 pt-1'>
        <div className={cn('mb-2', { 'font-bold': unread })}>
          <span
            dangerouslySetInnerHTML={{ __html: titleForNotification(notification, t) }}
          />
        </div>
        <div>
          <span
            dangerouslySetInnerHTML={{ __html: bodyForNotification(notification, t) }}
          />
        </div>
        <div className='text-xs text-muted-foreground/50'>{TextHelpers.humanDate(notification.createdAt)}</div>
      </div>
    </li>
  )
}
