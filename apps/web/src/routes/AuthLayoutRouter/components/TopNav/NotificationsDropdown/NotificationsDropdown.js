import cx from 'classnames'
import { isEmpty, some } from 'lodash/fp'
import React, { useState, useRef, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { TextHelpers } from '@hylo/shared'
import RoundImage from 'components/RoundImage'
import ScrollListener from 'components/ScrollListener/ScrollListener'
import LoadingItems from 'routes/AuthLayoutRouter/components/TopNav/LoadingItems'
import NoItems from 'routes/AuthLayoutRouter/components/TopNav/NoItems'
import { bodyForNotification, titleForNotification, urlForNotification } from 'store/models/Notification'
import TopNavDropdown from '../TopNavDropdown'
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

import classes from './NotificationsDropdown.module.scss'

const NOTIFICATIONS_PAGE_SIZE = 20

function NotificationsDropdown ({ renderToggleChildren, className }) {
  const [showingUnread, setShowingUnread] = useState(false)
  const [lastOpenedAt, setLastOpenedAt] = useState(null)
  const dropdownRef = useRef(null)
  const { t } = useTranslation()
  const dispatch = useDispatch()

  const notifications = useSelector(getNotifications)
  const hasMore = useSelector(getHasMoreNotifications)
  const currentUser = useSelector(getMe)
  const pending = useSelector(state => state.pending[FETCH_NOTIFICATIONS])

  useEffect(() => {
    dispatch(fetchNotifications())
  }, [dispatch])

  const onToggle = nowActive => {
    if (nowActive) {
      setLastOpenedAt(new Date())
      if (!pending) dispatch(fetchNotifications())
    }
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
    dropdownRef.current.toggle(false)
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
      <div className={classes.notifications} id='notifications-scroll-list'>
        {filteredNotifications.map(notification => <Notification
          notification={notification}
          onClick={onClick}
          key={notification.id} />)}
        <ScrollListener
          elementId='notifications-scroll-list'
          onBottom={hasMore ? fetchMore : () => {}}
        />
        {pending && <LoadingItems />}
      </div>
    )
  }

  return (
    <TopNavDropdown
      ref={dropdownRef}
      className={className}
      onToggle={onToggle}
      toggleChildren={renderToggleChildren(hasUnread())}
      header={
        <div className={classes.headerContent}>
          <span onClick={showRecent} className={cx(classes.tab, { [classes.active]: !showingUnread })}>
            {t('Recent')}
          </span>
          <span onClick={showUnread} className={cx(classes.tab, { [classes.active]: showingUnread })}>
            {t('Unread')}
          </span>
          <span onClick={() => dispatch(markAllActivitiesRead())} className={classes.markRead}>{t('Mark all as read')}</span>
        </div>
      }
      body={body}
    />
  )
}

export function Notification ({ notification, onClick }) {
  const { activity: { unread, actor } } = notification
  const { t } = useTranslation()

  return (
    <li
      className={cx(classes.notification, { [classes.unread]: unread })}
      onClick={() => onClick(notification)}
    >
      <div className={classes.imageWraper}>
        <RoundImage url={actor.avatarUrl} />
      </div>
      <div className={classes.content}>
        <div className={classes.header}>
          <span
            dangerouslySetInnerHTML={{ __html: titleForNotification(notification, t) }}
          />
        </div>
        <div className={classes.body}>
          <span
            dangerouslySetInnerHTML={{ __html: bodyForNotification(notification, t) }}
          />
        </div>
        <div className={classes.date}>{TextHelpers.humanDate(notification.createdAt)}</div>
      </div>
    </li>
  )
}

export default NotificationsDropdown
