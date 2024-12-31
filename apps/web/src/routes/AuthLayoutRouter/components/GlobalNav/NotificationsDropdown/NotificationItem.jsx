import { cn } from 'util'
import React from 'react'
import { useTranslation } from 'react-i18next'
import { TextHelpers } from '@hylo/shared'
import RoundImage from 'components/RoundImage'
import { bodyForNotification, titleForNotification } from 'store/models/Notification'

export default function NotificationItem ({ notification, onClick }) {
  const { activity: { unread, actor } } = notification
  const { t } = useTranslation()

  return (
    <li
      className={cn('flex items-start cursor-pointer border-b border-border text-sm text-muted-foreground py-3', { 'bg-primary/20 text-foreground': unread })}
      onClick={() => onClick(notification)}
    >
      <div className='my-1 pl-3'>
        <RoundImage url={actor.avatarUrl} />
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
