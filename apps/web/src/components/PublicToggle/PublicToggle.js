import PropTypes from 'prop-types'
import React, { Component } from 'react'
import { withTranslation } from 'react-i18next'
import { cn } from 'util/index'
import SwitchStyled from 'components/SwitchStyled'
import Icon from 'components/Icon'
import classes from './PublicToggle.module.scss'
const { func, bool } = PropTypes

class PublicToggle extends Component {
  static propTypes = {
    isPublic: bool,
    togglePublic: func
  }

  static defaultProps = {
    isPublic: false
  }

  render () {
    const { isPublic, togglePublic, t } = this.props

    return (
      <div className={cn('w-full text-foreground/50 hover:text-foreground/100 text-xs cursor-pointer rounded', { [classes.postIsPublic]: isPublic })} onClick={togglePublic} role="button">
        <div className='w-full flex gap-2'>
          <SwitchStyled checked={isPublic} onChange={togglePublic} backgroundColor={isPublic ? 'hsl(var(--selected))' : 'hsl(var(--foreground))'} />
          <div>
            <span>{isPublic ? t('Post will be publicly visible and shareable') : t('Make Public - Currently, only groups you specify above will see this post')}</span>
          </div>
        </div>
      </div>
    )
  }
}
export default withTranslation()(PublicToggle)
