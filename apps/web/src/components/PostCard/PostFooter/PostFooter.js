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
      ...post
    } = this.props

    const tooltipId = 'postfooter-tt-' + postId

    return (
      <div onClick={onClick} className={cn('w-full text-foreground flex flex-wrap p-2 items-center', { [classes.constrained]: constrained }, { 'flex-col justify-start items-start gap-2': mapDrawer }, className)} data-testid='post-footer'>
        <EmojiRow
          post={post}
          currentUser={currentUser}
          onAddReaction={onAddReaction}
          onRemoveReaction={onRemoveReaction}
        />

        <div className='bg-black/10 rounded-lg py-2 px-3 h-[40px] items-center justify-center flex'>
          <PeopleInfo constrained={constrained} people={commenters} peopleTotal={commentersTotal} excludePersonId={get('id', currentUser)} />
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
