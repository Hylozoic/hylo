import { cn } from 'util/index'
import { isEmpty, some } from 'lodash/fp'
import React, { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import ScrollListener from 'components/ScrollListener/ScrollListener'
import { Popover, PopoverTrigger, PopoverContent } from 'components/ui/popover'
import NotificationItem from './NotificationItem'
import LoadingItems from 'routes/AuthLayoutRouter/components/GlobalNav/LoadingItems'
import NoItems from 'routes/AuthLayoutRouter/components/GlobalNav/NoItems'
import { urlForNotification } from 'store/models/Notification'
import { useSelector, useDispatch } from 'react-redux'
import { push } from 'redux-first-history'
import {
  fetchNotifications,
  markActivityRead,
  markAllActivitiesRead,
  getHasMoreNotifications,
  getNotifications
} from './NotificationsDropdown.store'
import getMe from 'store/selectors/getMe'
import { FETCH_NOTIFICATIONS } from 'store/constants'

const NOTIFICATIONS_PAGE_SIZE = 20

function NotificationsDropdown ({ renderToggleChildren, className }) {
  const [showingUnread, setShowingUnread] = useState(false)
  const [lastOpenedAt, setLastOpenedAt] = useState(null)
  const [modalOpen, setModalOpen] = useState(false)
  const { t } = useTranslation()
  const dispatch = useDispatch()

  const notifications = useSelector(getNotifications)
  const hasMore = useSelector(getHasMoreNotifications)
  const currentUser = useSelector(getMe)
  const pending = useSelector(state => state.pending[FETCH_NOTIFICATIONS])

  useEffect(() => {
    dispatch(fetchNotifications())
  }, [dispatch])

  const handleOpenChange = isOpen => {
    if (isOpen) {
      setLastOpenedAt(new Date())
      if (!pending) dispatch(fetchNotifications())
    }
    setModalOpen(isOpen)
  }

  const hasUnread = () => {
    if (isEmpty(notifications)) {
      return currentUser && currentUser.newNotificationCount > 0
    }

    const isUnread = n =>
      n.activity && n.activity.unread && (!lastOpenedAt || new Date(n.createdAt) > lastOpenedAt)

    return some(isUnread, notifications)
  }

  const showRecent = () => setShowingUnread(false)
  const showUnread = () => setShowingUnread(true)

  const filteredNotifications = showingUnread
    ? notifications.filter(n => n.activity.unread)
    : notifications

  const onClick = (notification) => {
    if (notification.activity.unread) dispatch(markActivityRead(notification.activity.id))
    dispatch(push(urlForNotification(notification)))
    setModalOpen(false)
  }

  const fetchMore = () => dispatch(fetchNotifications(NOTIFICATIONS_PAGE_SIZE, notifications.length))

  const message = showingUnread ? t('No unread notifications') : t('No notifications')

  let body
  if (pending && filteredNotifications.length === 0) {
    body = <LoadingItems />
  } else if (isEmpty(filteredNotifications)) {
    body = <NoItems message={message} />
  } else {
    body = (
      <div className='overflow-y-auto h-[calc(100vh-100px)]' id='notifications-scroll-list'>
        {filteredNotifications.map(notification => (
          <NotificationItem
            notification={notification}
            onClick={onClick}
            key={notification.id}
          />
        ))}
        <ScrollListener
          elementId='notifications-scroll-list'
          onBottom={hasMore ? fetchMore : () => {}}
        />
        {pending && <LoadingItems />}
      </div>
    )
  }

  return (
    <Popover onOpenChange={handleOpenChange} open={modalOpen}>
      <PopoverTrigger>
        {renderToggleChildren(hasUnread())}
      </PopoverTrigger>
      <PopoverContent side='right' align='start' className='!p-0 !w-[340px]'>
        <div className='flex items-center w-full z-10 p-2'>
          <span onClick={showRecent} className={cn('cursor-pointer text-accent mr-5 px-2', { 'border-b-2 border-accent relative': !showingUnread })}>
            {t('Recent')}
          </span>
          <span onClick={showUnread} className={cn('cursor-pointer text-accent mr-5 px-2', { 'border-b-2 border-accent relative': showingUnread })}>
            {t('Unread')}
          </span>
          <span onClick={() => dispatch(markAllActivitiesRead())} className='cursor-pointer text-accent ml-auto'>{t('Mark all as read')}</span>
        </div>
        {body}
      </PopoverContent>
    </Popover>
  )
}

export default NotificationsDropdown
