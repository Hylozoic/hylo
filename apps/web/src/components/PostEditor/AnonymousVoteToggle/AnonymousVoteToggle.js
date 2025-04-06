import PropTypes from 'prop-types'
import React, { Component } from 'react'
import { withTranslation } from 'react-i18next'
import { cn } from 'util/index'
import SwitchStyled from 'components/SwitchStyled'
import Icon from 'components/Icon'
import classes from './AnonymousVoteToggle.module.scss'
const { func, bool } = PropTypes

class AnonymousVoteToggle extends Component {
  static propTypes = {
    isAnonymousVote: bool,
    toggleAnonymousVote: func
  }

  static defaultProps = {
    isAnonymousVote: false
  }

  render () {
    const { isAnonymousVote, toggleAnonymousVote, t } = this.props

    return (
      <div className={cn('border-2 border-transparent transition-all bg-input rounded-md p-2 mb-4 transition-all text-xs', { 'bg-selected': isAnonymousVote })}>
        <div className='flex items-center gap-2'>
          <Icon name='Hidden' /><span className='text-foreground/50'> {t('Anonymous Vote:')}</span>
          <SwitchStyled checked={isAnonymousVote} onChange={toggleAnonymousVote} backgroundColor={isAnonymousVote ? '#0DC39F' : '#8B96A4'} />
          <span className={classes.guidance}>{isAnonymousVote ? t('Voting will be anonymous') : t('You can see how people voted')}</span>
        </div>
      </div>
    )
  }
}
export default withTranslation()(AnonymousVoteToggle)
