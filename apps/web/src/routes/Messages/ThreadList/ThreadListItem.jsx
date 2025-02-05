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

const MAX_THREAD_PREVIEW_LENGTH = 70

export default function ThreadListItem ({
  currentUser, active, id, thread, latestMessage, unreadCount, isUnread
}) {
  const latestMessagePreview = TextHelpers.presentHTMLToText(latestMessage?.text, { truncate: MAX_THREAD_PREVIEW_LENGTH })
  const { names, avatarUrls } = participantAttributes(thread, currentUser, 2)

  return (
    <li className={cn(classes.listItem, { [classes.unreadListItem]: isUnread, [classes.active]: active })}>
      <Link to={`/messages/${id}`}>
        {active && <div className={classes.activeThread} />}
        <ThreadAvatars avatarUrls={avatarUrls} />
        <div className={classes.liCenterContent}>
          <ThreadNames names={names} />
          <div className={classes.threadMessageText}>{latestMessagePreview}</div>
        </div>
        <div className={classes.liRightContent}>
          <div className={classes.messageTime}>{TextHelpers.humanDate(get('createdAt', latestMessage))}</div>
          {unreadCount > 0 && <Badge number={unreadCount} expanded />}
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
    <div className={classes.threadAvatars}>
      {(count === 1 || count === 2) && <RoundImage url={avatarUrls[0]} />}
      {count === 2 && <RoundImage url={avatarUrls[1]} medium className={classes[style]} />}
      {count > 2 && <RoundImage url={avatarUrls[0]} medium className={classes[style]} />}
      {count > 2 && <RoundImage url={avatarUrls[1]} medium className={classes[style]} />}
      {count > 2 && <RoundImage url={avatarUrls[2]} medium className={classes[style]} />}
      {count === 4 && <RoundImage url={avatarUrls[3]} medium className={classes[style]} />}
      {count > 4 && <div className={plusStyle}>+{count - 4}</div>}
    </div>
  )
}

function ThreadNames ({ names }) {
  return <div className={classes.threadNames}>{names}</div>
}
