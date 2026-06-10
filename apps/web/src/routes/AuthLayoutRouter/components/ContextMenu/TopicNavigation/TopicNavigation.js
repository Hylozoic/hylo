import React, { useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { useDispatch, useSelector } from 'react-redux'
import { push } from 'redux-first-history'
import { get } from 'lodash/fp'
import { cn } from 'util/index'
import { Link, NavLink } from 'react-router-dom'
import { topicsUrl, allGroupsUrl } from '@hylo/navigation'
import Badge from 'components/Badge'
import Icon from 'components/Icon'
import resetNewPostCount from 'store/actions/resetNewPostCount'
import { FETCH_POSTS } from 'store/constants'
import { makeDropQueryResults } from 'store/reducers/queryResults'
import badgeHoverStyles from '../../../../../components/Badge/component.module.scss'
import { getTopicsFromSubscribedGroupTopics } from './TopicNavigation.store'
import styles from './TopicNavigation.module.scss'

const dropPostResults = makeDropQueryResults(FETCH_POSTS)

export default function TopicNavigation (props) {
  const {
    topics: topicsProp,
    seeAllUrl: seeAllUrlProp,
    backUrl,
    routeParams
  } = props

  const dispatch = useDispatch()
  const streamFetchPostsParam = useSelector(state => get('Stream.fetchPostsParam', state))
  const topicsFromStore = useSelector(state => getTopicsFromSubscribedGroupTopics(state, props))

  const topics = topicsProp ?? topicsFromStore
  const seeAllUrl = seeAllUrlProp ?? topicsUrl(routeParams, allGroupsUrl())

  const clearBadge = useCallback((id) => {
    dispatch(resetNewPostCount(id, 'TopicFollow'))
  }, [dispatch])

  const clearStream = useCallback(() => {
    dispatch(dropPostResults(streamFetchPostsParam))
  }, [dispatch, streamFetchPostsParam])

  const goBack = useCallback((event) => {
    event.preventDefault()
    dispatch(push(backUrl))
  }, [dispatch, backUrl])

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

export function TopicsList ({ topics, onClick, onClose }) {
  return (
    <ul className={styles.topics}>
      {topics.map(topic => (
        <li key={topic.name} className={cn(styles.topic, { [styles.pinned]: topic.visibility === 2 })}>
          <NavLink
            className={({ isActive }) => cn(badgeHoverStyles.parent, styles.topicLink, { [styles.activeTopicNavLink]: isActive })}
            to={topic.url}
            onClick={() => onClick(topic)}
          >
            <span className={styles.name}>#{topic.name}</span>
            {topic.newPostCount > 0 && !topic.current &&
              <Badge number={topic.newPostCount} className={styles.badge} />}
            {topic.visibility === 2 && <Icon name='Pin' className={styles.pinIcon} />}
            {topic.current &&
              <Icon name='Ex' className={styles.closeIcon} onClick={onClose} />}
          </NavLink>
        </li>
      ))}
    </ul>
  )
}
