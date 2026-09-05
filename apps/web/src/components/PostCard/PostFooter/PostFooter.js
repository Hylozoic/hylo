import React from 'react'
import { withTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { cn } from 'util/index'
import EmojiRow from 'components/EmojiRow'
import { get } from 'lodash/fp'
import PropTypes from 'prop-types'
import PeopleInfo from '../PeopleInfo'
import Tooltip from 'components/Tooltip'
import { CURRENT_USER_PROP_TYPES } from 'store/models/Me'

import classes from './PostFooter.module.scss'

class PostFooter extends React.PureComponent {
  static propTypes = {
    currentUser: PropTypes.shape(CURRENT_USER_PROP_TYPES),
    commenters: PropTypes.array,
    commentersTotal: PropTypes.number,
    constrained: PropTypes.bool,
    t: PropTypes.func
  }

  render () {
    const {
      className,
      currentUser,
      commenters,
      commentersTotal,
      constrained,
      onClick,
      onAddReaction = () => {},
      onRemoveReaction = () => {},
      postId,
      mapDrawer,
      t,
      ...post
    } = this.props

    const tooltipId = 'postfooter-tt-' + postId
    const loginUrl = `/login?returnToUrl=${encodeURIComponent(window.location.pathname + window.location.search)}`

    // Logged-out: show commenter count only (no names/avatars), linked to login
    const total = commentersTotal || 0
    const anonymousCommentLabel = total === 0
      ? t('Be the first to comment')
      : total === 1
        ? t('{{count}} person commented', { count: 1 })
        : t('{{count}} people commented', { count: total })

    return (
      <div onClick={onClick} className={cn('w-full text-foreground flex flex-wrap p-1 justify-between items-center', { [classes.constrained]: constrained }, { 'flex-col justify-start items-start gap-2': mapDrawer }, className)} data-testid='post-footer'>
        <EmojiRow
          post={post}
          currentUser={currentUser}
          onAddReaction={onAddReaction}
          onRemoveReaction={onRemoveReaction}
        />

        <div className='bg-darkening/5 rounded-lg py-2 mb-1 mr-1 px-2 items-center justify-center flex'>
          {currentUser
            ? (
              <PeopleInfo
                constrained={constrained}
                people={commenters}
                peopleTotal={commentersTotal}
                excludePersonId={get('id', currentUser)}
                small
              />
              )
            : (
              <Link
                to={loginUrl}
                className='text-foreground no-underline text-sm'
                onClick={e => e.stopPropagation()}
              >
                {anonymousCommentLabel}
              </Link>
              )}
        </div>
        <Tooltip
          delay={550}
          id={tooltipId}
        />
      </div>
    )
  }
}

export default withTranslation()(PostFooter)
