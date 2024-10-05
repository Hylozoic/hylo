import React, { Component } from 'react'
import { withTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { bgImageStyle } from 'util/index'
import { get } from 'lodash/fp'
import cx from 'classnames'
import classes from '../WelcomeWizard.module.scss'

class WelcomeExplore extends Component {
  getValue = (field) => {
    return get(field, this.props.currentUser)
  }

  render () {
    const { currentUser, t } = this.props
    const currentAvatarUrl = this.getValue('avatarUrl')

    return (
      <div className={cx(classes.flexWrapper, classes.finalWrapper)}>
        <div className={cx(classes.panel, classes.finalPanel)}>
          <div className={classes.instructions}>
            <h3>{t('Welcome to Hylo!')}</h3>
            <p>{t(`We're glad you're here, {{firstName}}. To get started, explore public groups and posts, or create your own group!`, { firstName: currentUser.name.split(' ')[0] })}</p>
          </div>
          <Link to='/public/map?hideDrawer=true'>
            <div className={classes.finalStep}>
              <div className={cx(classes.stepImage, classes.map)} style={bgImageStyle('/signup-globe.png')} />
              <div>
                <h4>{t('View the public map')}</h4>
                <p>{t('Find out what\'s happening around you, and groups you can join')}</p>
              </div>
            </div>
          </Link>
          <Link to='/public'>
            <div className={classes.finalStep}>
              <div className={cx(classes.stepImage, classes.stream)} style={bgImageStyle('/signup-stream.png')} />
              <div>
                <h4>{t('Public stream')}</h4>
                <p>{t('View and participate in public discussions, projects, events & more')}</p>
              </div>
            </div>
          </Link>
          <Link to={`/public/create/group?closePath=${encodeURIComponent('/public')}`}>
            <div className={classes.finalStep}>
              <div className={cx(classes.stepImage, classes.group)} style={bgImageStyle('/signup-group.png')} />
              <div>
                <h4>{t('Create a group')}</h4>
                <p>{t('Gather your collaborators & people who share your interests')}</p>
              </div>
            </div>
          </Link>
          <Link to='/settings'>
            <div className={classes.finalStep}>
              <div className={cx(classes.stepImage, classes.profile)} style={bgImageStyle(currentAvatarUrl)}>
                <div className={classes.profileCover} />
              </div>
              <div>
                <h4>{t('Complete your profile')}</h4>
                <p>{t('Share about who you are, your skills & interests')}</p>
              </div>
            </div>
          </Link>
        </div>
      </div>
    )
  }
}

export default withTranslation()(WelcomeExplore)
