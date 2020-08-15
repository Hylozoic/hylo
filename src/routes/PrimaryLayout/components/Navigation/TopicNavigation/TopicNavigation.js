import React, { Component } from 'react'
import cx from 'classnames'
import PropTypes from 'prop-types'
import { Link, NavLink } from 'react-router-dom'
import Badge from 'components/Badge'
import Icon from 'components/Icon'
import badgeHoverStyles from '../../../../../components/Badge/component.scss'
import s from './TopicNavigation.scss' // eslint-disable-line no-unused-vars

const { array, string, bool, func, object } = PropTypes

export default class TopicNavigation extends Component {
  static propTypes = {
    topics: array,
    routeParams: object,
    communitySlug: string,
    communityId: string,
    seeAllUrl: string,
    backUrl: string,
    clearBadge: func,
    clearFeedList: func,
    collapsed: bool,
    expand: func
  }

  onClickTopic = communityTopic => {
    const { clearBadge, clearFeedList } = this.props
    const { id, topic } = communityTopic

    if (id) {
      this.currentTopic(topic.name) && clearFeedList()
      communityTopic.newPostCount > 0 && clearBadge(id)
    }
  }

  render () {
    const {
      topics, goBack, seeAllUrl, collapsed, expand
    } = this.props

    return <div styleName={cx('s.topicNavigation', { 's.collapsed': collapsed })}>
      <div styleName={cx('s.header', { 's.header-link': collapsed })} onClick={expand}>
        <Icon name='Topics' styleName='s.icon' />
        <Link to={seeAllUrl}>
          <span styleName='s.title'>Topics</span>
        </Link>
        {/* TODO: remove for now, probably for good?
          {communityId && <CreateTopic
          communityId={communityId}
          communitySlug={slug}
          topics={topics}
        />} */}
      </div>
      <TopicsList
        onClose={goBack}
        onClick={this.onClickTopic}
        topics={topics}
      />
      <div styleName='s.addTopic'>
        <Link to={seeAllUrl}>see all</Link>
      </div>
    </div>
  }
}

export function TopicsList ({ topics, onClick, onClose }) {
  return <ul styleName='s.topics'>
    {topics.map(topic =>
      <li key={topic.name} styleName='s.topic' className={cx({ [s.pinned]: topic.visibility === 2 })}>
        <NavLink className={badgeHoverStyles.parent}
          styleName='s.topicLink'
          to={topic.url}
          // TODO: Removing onClick event for now
          //       but not sure why it's breaking things
          // onClick={() => onClick(topic)}
          activeClassName='active-topic-nav-link'
        >
          { topic.visibility === 2 && <Icon name='Pin' styleName='s.pinIcon' /> }
          <span styleName='s.name'>#{topic.name}</span>
          {topic.newPostCount > 0 && !topic.current &&
            <Badge number={topic.newPostCount} styleName='s.badge' />}
          {topic.current &&
            <Icon name='Ex' styleName='s.closeIcon' onClick={onClose} />}
        </NavLink>
      </li>)}
  </ul>
}
