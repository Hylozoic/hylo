import React from 'react'
import { useTranslation } from 'react-i18next'
import { cn } from 'util/index'
import { Link, NavLink } from 'react-router-dom'
import Badge from 'components/Badge'
import Icon from 'components/Icon'
import usePrefetchChatRoom from 'hooks/usePrefetchChatRoom'
import badgeHoverStyles from '../../../../../components/Badge/component.module.scss'
import styles from './TopicNavigation.module.scss'

export default function TopicNavigation ({
  topics,
  goBack,
  seeAllUrl,
  clearBadge,
  clearStream
}) {
  // XXX: not sure exactly what this doing and if we need, we have not been doing this for a while and things seemed to work
  const handleClearTopic = groupTopic => {
    const { current, groupTopicId, newPostCount } = groupTopic

    if (groupTopicId) {
      current && clearStream()
      newPostCount > 0 && clearBadge(groupTopicId)
    }
  }
  const { t } = useTranslation()

  return (
    <div className={cn(styles.topicNavigation)}>
      <div className={cn(styles.header)}>
        <Link to={seeAllUrl}>
          <Icon name='Topics' className={styles.icon} />
          <span className={styles.title}>{t('Topics')}</span>
        </Link>
      </div>
      <TopicsList
        onClose={goBack}
        onClick={handleClearTopic}
        topics={topics}
      />
      <div className={styles.addTopic}>
        <Link to={seeAllUrl} className={styles.allTopics}>{t('All topics')}</Link>
      </div>
    </div>
  )
}

// Wrapper component for topic link with prefetch on hover
function TopicLink ({ topic, onClick, onClose }) {
  const { handlePrefetch, cancelPrefetch } = usePrefetchChatRoom({
    groupId: topic.groupId,
    topicName: topic.name
  })

  return (
    <NavLink
      className={({ isActive }) => cn(badgeHoverStyles.parent, styles.topicLink, { [styles.activeTopicNavLink]: isActive })}
      to={topic.url}
      onClick={() => onClick(topic)}
      onMouseEnter={handlePrefetch}
      onMouseLeave={cancelPrefetch}
    >
      <span className={styles.name}>#{topic.name}</span>
      {topic.newPostCount > 0 && !topic.current &&
        <Badge number={topic.newPostCount} className={styles.badge} />}
      {topic.visibility === 2 && <Icon name='Pin' className={styles.pinIcon} />}
      {topic.current &&
        <Icon name='Ex' className={styles.closeIcon} onClick={onClose} />}
    </NavLink>
  )
}

export function TopicsList ({ topics, onClick, onClose }) {
  return (
    <ul className={styles.topics}>
      {topics.map(topic => (
        <li key={topic.name} className={cn(styles.topic, { [styles.pinned]: topic.visibility === 2 })}>
          <TopicLink
            topic={topic}
            onClick={onClick}
            onClose={onClose}
          />
        </li>
      ))}
    </ul>
  )
}
