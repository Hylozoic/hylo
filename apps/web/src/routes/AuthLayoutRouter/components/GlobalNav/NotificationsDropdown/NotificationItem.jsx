import { cn } from 'util/index'
import React from 'react'
import { useTranslation } from 'react-i18next'
import { TextHelpers } from '@hylo/shared'
import RoundImage from 'components/RoundImage'
import { bodyForNotification, titleForNotification, imageForNotification } from '@hylo/presenters/NotificationPresenter'

export default function NotificationItem ({ notification, onClick }) {
  const { activity: { unread } } = notification
  const { t } = useTranslation()

  return (
    <li
      className={cn('flex items-start cursor-pointer border-b border-border text-sm text-muted-foreground py-3 bg-black/10 opacity-80 hover:opacity-100 transition-all', { 'bg-white/10 opacity-100 text-foreground': unread })}
      onClick={(event) => {
        event.stopPropagation()
        onClick(event, notification)
      }}
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
