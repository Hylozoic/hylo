import { get } from 'lodash/fp'
import React from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { bgImageStyle } from 'util/index'

const WelcomeExplore = ({ currentUser }) => {
  const { t } = useTranslation()

  const getValue = (field) => {
    return get(field, currentUser)
  }

  const currentAvatarUrl = getValue('avatarUrl')

  return (
    <div className='bg-background/50 w-[360px] mx-auto rounded-lg'>
      <div className='p-4 sm:p-8'>
        <div className='text-center mb-6'>
          <h3 className='text-2xl font-bold text-foreground mb-2'>{t('Welcome to Hylo!')}</h3>
          <p className='text-muted-foreground'>
            {t('We\'re glad you\'re here, {{firstName}}. To get started, explore public groups and posts, or create your own group!', { firstName: currentUser.name.split(' ')[0] })}
          </p>
        </div>

        <Link to='/public/map?hideDrawer=true'>
          <div className='flex items-center bg-background shadow-lg hover:shadow-xl rounded-lg p-4 mb-4 transition-all duration-300 hover:-translate-y-1 group'>
            <div
              className='min-w-[80px] min-h-[80px] mr-4 rounded-lg transition-all duration-300 shadow-lg group-hover:shadow-[0px_5px_15px_rgba(79,118,193,0.7)] bg-center bg-cover'
              style={bgImageStyle('/signup-globe.png')}
            />
            <div>
              <h4 className='text-base font-bold text-foreground mb-1'>{t('View the public map')}</h4>
              <p className='text-sm text-muted-foreground leading-tight'>{t('Find out what\'s happening around you, and groups you can join')}</p>
            </div>
          </div>
        </Link>

        <Link to='/public/stream'>
          <div className='flex items-center bg-background shadow-lg hover:shadow-xl rounded-lg p-4 mb-4 transition-all duration-300 hover:-translate-y-1 group'>
            <div
              className='min-w-[80px] min-h-[80px] mr-4 rounded-lg transition-all duration-300 shadow-lg group-hover:shadow-[0px_5px_15px_rgba(22,178,190,0.7)] bg-center bg-cover'
              style={bgImageStyle('/signup-stream.png')}
            />
            <div>
              <h4 className='text-base font-bold text-foreground mb-1'>{t('Public stream')}</h4>
              <p className='text-sm text-muted-foreground leading-tight'>{t('View and participate in public discussions, projects, events & more')}</p>
            </div>
          </div>
        </Link>

        <Link to={`/create-group?closePath=${encodeURIComponent('/public')}`}>
          <div className='flex items-center bg-background shadow-lg hover:shadow-xl rounded-lg p-4 mb-4 transition-all duration-300 hover:-translate-y-1 group'>
            <div
              className='min-w-[80px] min-h-[80px] mr-4 rounded-lg transition-all duration-300 shadow-lg group-hover:shadow-[0px_5px_15px_rgba(129,174,101,0.7)] bg-center bg-cover'
              style={bgImageStyle('/signup-group.png')}
            />
            <div>
              <h4 className='text-base font-bold text-foreground mb-1'>{t('Create a group')}</h4>
              <p className='text-sm text-muted-foreground leading-tight'>{t('Gather your collaborators & people who share your interests')}</p>
            </div>
          </div>
        </Link>

        <Link to='/my/edit-profile'>
          <div className='flex items-center bg-background shadow-lg hover:shadow-xl rounded-lg p-4 mb-4 transition-all duration-300 hover:-translate-y-1 group'>
            <div className='relative min-w-[80px] min-h-[80px] mr-4 rounded-lg transition-all duration-300 shadow-lg group-hover:shadow-[0px_5px_15px_rgba(238,136,56,0.7)] bg-center bg-cover overflow-hidden' style={bgImageStyle(currentAvatarUrl)}>
              <div className='absolute inset-0 bg-gradient-to-br from-[rgba(235,87,87,0.7)] to-[rgba(238,194,40,0.7)] opacity-70' />
            </div>
            <div>
              <h4 className='text-base font-bold text-foreground mb-1'>{t('Complete your profile')}</h4>
              <p className='text-sm text-muted-foreground leading-tight'>{t('Share about who you are, your skills & interests')}</p>
            </div>
          </div>
        </Link>
      </div>
    </div>
  )
}

export default WelcomeExplore
