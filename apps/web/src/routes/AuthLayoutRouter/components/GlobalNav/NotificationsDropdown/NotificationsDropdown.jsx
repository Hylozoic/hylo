import { cn } from 'util/index'
import { isEmpty, some } from 'lodash/fp'
import React, { useCallback, useMemo, useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import ScrollListener from 'components/ScrollListener/ScrollListener'
import { Popover, PopoverTrigger, PopoverContent } from 'components/ui/popover'
import NotificationItem from './NotificationItem'
import LoadingItems from 'routes/AuthLayoutRouter/components/GlobalNav/LoadingItems'
import NoItems from 'routes/AuthLayoutRouter/components/GlobalNav/NoItems'
import { urlForNotification } from '@hylo/presenters/NotificationPresenter'
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

  // Allow scroll events to pass through to GlobalNav even when a modal post dialog is open
  useEffect(() => {
    setTimeout(() => {
      const container = document.getElementById('notifications-scroll-list')
      if (container) {
        container.addEventListener('wheel', (e) => { console.log('wheel event', e); e.stopPropagation() }, { passive: false })
      }
    }, 100)
  }, [modalOpen])

  const handleOpenChange = useCallback(isOpen => {
    if (isOpen) {
      setLastOpenedAt(new Date())
      if (!pending) dispatch(fetchNotifications())
    }
    setModalOpen(isOpen)
  }, [])

  const hasUnread = useMemo(() => {
    if (isEmpty(notifications)) {
      return currentUser?.newNotificationCount > 0
    }

    const isUnread = n =>
      n.activity && n.activity.unread && (!lastOpenedAt || new Date(n.createdAt) > lastOpenedAt)

    return some(isUnread, notifications) || currentUser?.newNotificationCount > 0
  }, [notifications, currentUser?.newNotificationCount, lastOpenedAt])

  const showRecent = useCallback(() => setShowingUnread(false))
  const showUnread = useCallback(() => setShowingUnread(true))

  const filteredNotifications = useMemo(() => {
    return showingUnread
      ? notifications.filter(n => n.activity.unread)
      : notifications
  }, [notifications, showingUnread])

  const onClick = useCallback((event, notification) => {
    if (notification.activity.unread) dispatch(markActivityRead(notification.activity.id))
    const url = urlForNotification(notification)
    if (event.metaKey || event.ctrlKey) {
      window.open(url, '_blank')
    } else {
      dispatch(push(url))
    }
    setModalOpen(false)
  }, [])

  const fetchMore = useCallback(() => dispatch(fetchNotifications(NOTIFICATIONS_PAGE_SIZE, notifications.length)), [notifications.length])

  const message = useMemo(() => showingUnread ? t('No unread notifications') : t('No notifications'), [showingUnread])

  const body = useMemo(() => {
    if (pending && filteredNotifications.length === 0) {
      return <LoadingItems />
    } else if (isEmpty(filteredNotifications)) {
      return <NoItems message={message} />
    } else {
      return (
        <div className='overflow-y-auto h-[calc(100vh-100px)] pointer-events-auto' id='notifications-scroll-list'>
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
  }, [pending, filteredNotifications, message, onClick, hasMore])

  return (
    <Popover onOpenChange={handleOpenChange} open={modalOpen}>
      <PopoverTrigger>
        {renderToggleChildren(hasUnread)}
      </PopoverTrigger>
      <PopoverContent side='right' align='start' className='!p-0 !w-[248px] sm:!w-[300px]'>
        <div className='flex items-center w-full z-10 p-2 pointer-events-auto'>
          <span onClick={showRecent} className={cn('cursor-pointer text-accent mr-5 px-2 text-xs sm:text-sm', { 'border-b-2 border-accent relative': !showingUnread })}>
            {t('Recent')}
          </span>
          <span onClick={showUnread} className={cn('cursor-pointer text-accent mr-5 px-2 text-xs sm:text-sm', { 'border-b-2 border-accent relative': showingUnread })}>
            {t('Unread')}
          </span>
          <span onClick={() => dispatch(markAllActivitiesRead())} className='cursor-pointer text-accent ml-auto text-xs sm:text-sm'>{t('Mark all as read')}</span>
        </div>
        {body}
      </PopoverContent>
    </Popover>
  )
}

export default NotificationsDropdown
