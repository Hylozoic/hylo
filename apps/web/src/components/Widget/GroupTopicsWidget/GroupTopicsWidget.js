import PropTypes from 'prop-types'
import React from 'react'
import { Link } from 'react-router-dom'
import { topicUrl } from '@hylo/navigation'
import usePrefetchChatRoom from 'hooks/usePrefetchChatRoom'

import classes from './GroupTopicsWidget.module.scss'

const { array, object } = PropTypes

// Individual topic link with prefetch support
function TopicLink ({ topic, group }) {
  const { handlePrefetch, cancelPrefetch } = usePrefetchChatRoom({
    groupId: group.id,
    topicName: topic.name
  })

  return (
    <Link
      key={topic.id}
      to={topicUrl(topic.name, { groupSlug: group.slug, context: 'groups' })}
      onMouseEnter={handlePrefetch}
      onMouseLeave={cancelPrefetch}
    >
      <div className={classes.topicWrapper}>
        <div className={classes.topicWrapper}>
          <div className={classes.topic}>
            <span className={classes.numPosts}>{topic.postsTotal}</span>
            <span className={classes.topicName}>{topic.name}</span>
          </div>
        </div>
      </div>
    </Link>
  )
}

TopicLink.propTypes = {
  topic: object.isRequired,
  group: object.isRequired
}

export default function GroupTopicsWidget ({ items, group }) {
  return (
    <div className={classes.groupTopics}>
      {items && items.map(t => (
        <TopicLink key={t.id} topic={t} group={group} />
      ))}
    </div>
  )
}

GroupTopicsWidget.propTypes = {
  items: array,
  group: object
}
