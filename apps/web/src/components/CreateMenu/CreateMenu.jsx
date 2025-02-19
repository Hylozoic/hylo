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
      <h2>{coordinates ? t('New post at this location:') + ' ' : t('What would you like to create?')}</h2>
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
          <Link to={createPostForPostTypePath} key={postType}>
            <div>
              <Icon name={iconName} className='w-10 h-10 mr-2' />
              <span className='text-lg font-semibold'>{t(postType)}</span>
            </div>
          </Link>
        )
      })}
      {/* Creating a Group by location is not currently supported in HyloApp */}
      {!isWebView() && (
        <Link to='/create-group' key='group'>
          <div>
            <Icon name='Groups' className='w-10 h-10 mr-2' />
            <span className='text-lg font-semibold'>{t('Group')}</span>
          </div>
        </Link>
      )}
    </div>
  )
}
