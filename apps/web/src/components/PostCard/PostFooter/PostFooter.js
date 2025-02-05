import React from 'react'
import { withTranslation } from 'react-i18next'
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
    constrained: PropTypes.bool
  }

  render () {
    const {
      currentUser,
      commenters,
      commentersTotal,
      constrained,
      onClick,
      onAddReaction = () => {},
      onRemoveReaction = () => {},
      postId,
      ...post
    } = this.props

    const tooltipId = 'postfooter-tt-' + postId

    return (
      <div onClick={onClick} className={cn('w-full text-foreground flex p-2', { [classes.constrained]: constrained })} data-testid='post-footer'>
        <EmojiRow
          post={post}
          currentUser={currentUser}
          onAddReaction={onAddReaction}
          onRemoveReaction={onRemoveReaction}
        />
        <PeopleInfo constrained={constrained} people={commenters} peopleTotal={commentersTotal} excludePersonId={get('id', currentUser)} />
        <Tooltip
          delay={550}
          id={tooltipId}
        />
      </div>
    )
  }
}

export default withTranslation()(PostFooter)
