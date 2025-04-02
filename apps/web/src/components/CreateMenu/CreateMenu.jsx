import React from 'react'
import { Link, useLocation } from 'react-router-dom'
import isWebView from 'util/webView'
import { POST_TYPES } from 'store/models/Post'
import Icon from 'components/Icon'
import { useTranslation } from 'react-i18next'

const postTypes = Object.keys(POST_TYPES).filter(t => t !== 'chat')

export default function CreateMenu ({ coordinates }) {
  const location = useLocation()
  const querystringParams = new URLSearchParams(location.search)
  const { t } = useTranslation()
  // These need to be invoked here so that they get picked up by the translation extractor
  t('request')
  t('discussion')
  t('offer')
  t('resource')
  t('project')
  t('proposal')
  t('event')

  return (
    <div>
      <h2 className='text-foreground/80 mb-3 font-bold mt-0 text-selected'>{coordinates ? t('New post at this location:') + ' ' : t('What would you like to create?')}</h2>
      <div className='flex flex-col gap-2'>
        {postTypes.map(postType => {
          querystringParams.set('newPostType', postType)
          if (coordinates) {
            querystringParams.set('lat', coordinates.lat)
            querystringParams.set('lng', coordinates.lng)
          }

          const createPostForPostTypePath = `${location.pathname}/create/post?${querystringParams.toString()}`
          const postTypeUppercase = postType.charAt(0).toUpperCase() + postType.slice(1)
          const iconName = postType === 'request' ? 'Heart' : postTypeUppercase

          return (
            <Link to={createPostForPostTypePath} key={postType} className='text-foreground transition-all hover:scale-105 hover:text-foreground group'>
              <div className='flex items-center rounded-lg border-2 border-foreground/20 hover:border-foreground/100 transition-all p-1 px-2'>
                <Icon name={iconName} className='mr-2' />
                <span className='text-base'>{t(postType)}</span>
                <span className='text-xs text-selected/100 opacity-0 group-hover:opacity-100 transition-all absolute right-1 rounded-lg bg-selected/30 px-1 py-1'>{t('Create')}</span>
              </div>
            </Link>
          )
        })}
        {/* Creating a Group by location is not currently supported in HyloApp */}
        {!isWebView() && (
          <Link to='/create-group' key='group' className='text-foreground transition-all hover:scale-105 hover:text-foreground group'>
            <div className='flex text-base items-center p-0 rounded-lg border-2 border-foreground/20 hover:border-foreground/100 transition-all p-1 px-2'>
              <Icon name='Groups' className='mr-2' />
              <span className='text-base'>{t('Group')}</span>
              <span className='text-xs text-selected/100 opacity-0 group-hover:opacity-100 transition-all absolute right-1 rounded-lg bg-selected/30 px-1 py-1'>{t('Create')}</span>
            </div>
          </Link>
        )}
      </div>
    </div>
  )
}
