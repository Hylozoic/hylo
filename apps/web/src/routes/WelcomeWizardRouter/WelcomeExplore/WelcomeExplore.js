import { get } from 'lodash/fp'
import React from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { bgImageStyle, cn } from 'util/index'

import classes from '../WelcomeWizard.module.scss'

const WelcomeExplore = ({ currentUser }) => {
  const { t } = useTranslation()

  const getValue = (field) => {
    return get(field, currentUser)
  }

  const currentAvatarUrl = getValue('avatarUrl')

  return (
    <div className={cn(classes.flexWrapper, classes.finalWrapper)}>
      <div className={cn(classes.panel, classes.finalPanel)}>
        <div className={classes.instructions}>
          <h3>{t('Welcome to Hylo!')}</h3>
          <p>{t('We\'re glad you\'re here, {{firstName}}. To get started, explore public groups and posts, or create your own group!', { firstName: currentUser.name.split(' ')[0] })}</p>
        </div>
        <Link to='/public/map?hideDrawer=true'>
          <div className={classes.finalStep}>
            <div className={cn(classes.stepImage, classes.map)} style={bgImageStyle('/signup-globe.png')} />
            <div>
              <h4>{t('View the public map')}</h4>
              <p>{t('Find out what\'s happening around you, and groups you can join')}</p>
            </div>
          </div>
        </Link>
        <Link to='/public/stream'>
          <div className={classes.finalStep}>
            <div className={cn(classes.stepImage, classes.stream)} style={bgImageStyle('/signup-stream.png')} />
            <div>
              <h4>{t('Public stream')}</h4>
              <p>{t('View and participate in public discussions, projects, events & more')}</p>
            </div>
          </div>
        </Link>
        <Link to={`/create-group?closePath=${encodeURIComponent('/public')}`}>
          <div className={classes.finalStep}>
            <div className={cn(classes.stepImage, classes.group)} style={bgImageStyle('/signup-group.png')} />
            <div>
              <h4>{t('Create a group')}</h4>
              <p>{t('Gather your collaborators & people who share your interests')}</p>
            </div>
          </div>
        </Link>
        <Link to='/my/edit-profile'>
          <div className={classes.finalStep}>
            <div className={cn(classes.stepImage, classes.profile)} style={bgImageStyle(currentAvatarUrl)}>
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

export default WelcomeExplore
