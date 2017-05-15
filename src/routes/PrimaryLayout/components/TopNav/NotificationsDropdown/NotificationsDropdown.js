import React, { PropTypes, Component } from 'react'
import './NotificationsDropdown.scss'
const { object, array, string, func } = PropTypes
import { humanDate, textLength, truncate } from 'hylo-utils/text'
import cx from 'classnames'
import RoundImage from 'components/RoundImage'
import { firstName } from 'store/models/Person'
import TopNavDropdown from '../TopNavDropdown'
import { find } from 'lodash/fp'
import { ACTION_NEW_COMMENT, ACTION_TAG } from 'store/models/Notification'

export default class NotificationsDropdown extends Component {
  static propTypes = {
    fetchThreads: func,
    toggleChildren: object,
    notifications: array,
    className: string,
    goToThread: func
  }

  constructor (props) {
    super(props)
    this.state = {
      showingUnread: false
    }
  }

  componentDidMount () {
    this.props.fetchNotifications()
  }

  render () {
    const {
      toggleChildren, className, goToNotification, markAsRead
    } = this.props
    var { notifications } = this.props
    const { showingUnread } = this.state

    const showRecent = () => this.setState({showingUnread: false})
    const showUnread = () => this.setState({showingUnread: true})

    if (showingUnread) {
      notifications = notifications.filter(n => n.unread)
    }

    return <TopNavDropdown
      className={className}
      toggleChildren={toggleChildren}
      header={
        <div styleName='header-content'>
          <span onClick={showRecent} styleName={cx('tab', {active: !showingUnread})}>
            Recent
          </span>
          <span onClick={showUnread} styleName={cx('tab', {active: showingUnread})}>
            Unread
          </span>
          <span onClick={markAsRead} styleName='mark-read'>Mark all as read</span>
        </div>}
      body={
        <div styleName='notifications'>
          {notifications.map(notification => <Notification
            notification={notification}
            onClick={goToNotification}
            key={notification.id} />)}
        </div>
      } />
  }
}

export function Notification ({ notification, onClick }) {
  const { unread, actor } = notification

  return <li styleName={cx('notification', {unread})}
    onClick={() => onClick(notification)}>
    <div styleName='image-wraper'>
      <RoundImage url={actor.avatarUrl} />
    </div>
    <div styleName='content'>
      <NotificationHeader notification={notification} />
      <NotificationBody notification={notification} />
      <div styleName='date'>{humanDate(notification.createdAt)}</div>
    </div>
  </li>
}

export function NotificationHeader ({ notification }) {
  const { action, post, meta: { reasons } } = notification
  switch (action) {
    case ACTION_NEW_COMMENT:
      return <div styleName='header'>
        New Comment on <span styleName='bold'>{post.title}</span>
      </div>
    case ACTION_TAG:
      const tagReason = find(r => r.startsWith('tag: '), reasons)
      const tag = tagReason.split(': ')[1]
      return <div styleName='header'>
        New Post in <span styleName='bold'>#{tag}</span>
      </div>
  }

  return null
}

export function NotificationBody ({ notification }) {
  const { action, actor, post, comment } = notification

  const truncateForBody = text => textLength(text) > 76
    ? truncate(text, 76)
    : text

  switch (action) {
    case ACTION_NEW_COMMENT:
      var text = truncateForBody(comment.text)
      return <div styleName='body'>
        <span styleName='bold'>{firstName(actor)}</span> Wrote: "{text}"
      </div>
    case ACTION_TAG:
      text = truncateForBody(post.title)
      return <div styleName='body'>
        <span styleName='bold'>{firstName(actor)}</span> Wrote: "{text}"
      </div>
  }

  return null
}
