import React from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { GroupCell } from 'components/GroupsList/GroupsList'
import { inflectedTotal } from 'util/index'
import { topicUrl } from 'util/navigation'
import classes from './AllTopics.module.scss'

export default function TopicListItem ({ topic, singleGroup, routeParams, toggleSubscribe }) {
  const { name, groupTopics, postsTotal, followersTotal } = topic
  const { t } = useTranslation()
  let groupTopicContent

  if (singleGroup) {
    const groupTopic = topic.groupTopics.find(ct => ct.group.id === singleGroup.id)

    if (!groupTopic || (!groupTopic.isSubscribed && groupTopic.visibility === 0)) return null

    groupTopicContent = (
      <div className={classes.topicStats}>
        {inflectedTotal('post', postsTotal)} • {inflectedTotal('subscriber', followersTotal)} •
        {toggleSubscribe && (
          <span onClick={() => toggleSubscribe(groupTopic)} className={classes.topicSubscribe}>
            {groupTopic.isSubscribed ? t('Unsubscribe') : t('Subscribe')}
          </span>
        )}
      </div>
    )
  } else {
    const visibleGroupTopics = groupTopics.filter(ct => ct.isSubscribed || ct.visibility !== 0)
    if (visibleGroupTopics.length === 0) return null

    groupTopicContent = visibleGroupTopics.map((ct, key) => (
      <GroupCell group={ct.group} key={key}>
        <div className={classes.topicStats}>
          {inflectedTotal('post', ct.postsTotal)} • {inflectedTotal('subscriber', ct.followersTotal)} •
          {toggleSubscribe && (
            <span onClick={() => toggleSubscribe(ct)} className={classes.topicSubscribe}>
              {ct.isSubscribed ? t('Unsubscribe') : t('Subscribe')}
            </span>
          )}
        </div>
        <br />
      </GroupCell>
    ))
  }

  return (
    <div className={classes.topic}>
      <div className={classes.groupsList}>
        <Link className={classes.topicDetails} to={topicUrl(name, { ...routeParams, view: null })}>
          <div className={classes.topicName}>#{name}</div>
        </Link>
        {groupTopicContent}
      </div>
    </div>
  )
}
