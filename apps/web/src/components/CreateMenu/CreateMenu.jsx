import React, { useCallback, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useLocation } from 'react-router-dom'
import { useDispatch, useSelector } from 'react-redux'
import Icon from 'components/Icon'
import { POST_TYPES } from 'store/models/Post'
import { normalizeAcceptedPostTypes } from 'store/models/Group'
import { toggleNavMenu } from 'routes/AuthLayoutRouter/AuthLayoutRouter.store'
import { createGroupModalUrl, createPostModalUrl } from '@hylo/navigation'
import useRouteParams from 'hooks/useRouteParams'
import { useEffectiveGroupSlug } from 'contexts/SpaceGroupContext'
import getGroupForSlug from 'store/selectors/getGroupForSlug'

const postTypes = Object.keys(POST_TYPES).filter(t => !['action', 'chat', 'submission'].includes(t))

export default function CreateMenu ({ coordinates, mapView }) {
  const location = useLocation()
  const dispatch = useDispatch()
  const { t } = useTranslation()
  const routeParams = useRouteParams()
  const groupSlug = useEffectiveGroupSlug() || routeParams.groupSlug
  const currentGroup = useSelector(state => groupSlug ? getGroupForSlug(state, groupSlug) : null)
  const acceptedPostTypes = normalizeAcceptedPostTypes(currentGroup?.acceptedPostTypes)
  const visiblePostTypes = useMemo(() => {
    if (acceptedPostTypes == null) return postTypes
    return postTypes.filter(type => acceptedPostTypes.includes(type))
  }, [acceptedPostTypes])

  // Close the nav menu when a link is clicked
  const handleLinkClick = useCallback(() => {
    dispatch(toggleNavMenu(false))
  }, [dispatch])

  return (
    <div>
      <h2 className='text-foreground/80 mb-3 font-bold mt-0 text-selected'>{coordinates ? t('New post at this location:') + ' ' : t('What would you like to create?')}</h2>
      <div className='flex flex-col gap-2'>
        {visiblePostTypes.map(postType => {
          const extra = { newPostType: postType }
          if (coordinates) {
            extra.lat = coordinates.lat
            extra.lng = coordinates.lng
          }

          const createPostForPostTypePath = createPostModalUrl(location, extra)
          const postTypeUppercase = postType.charAt(0).toUpperCase() + postType.slice(1)
          const iconName = postType === 'request' ? 'Heart' : postTypeUppercase

          return (
            <Link to={createPostForPostTypePath} key={postType} onClick={handleLinkClick} className='text-foreground transition-all hover:scale-105 hover:text-foreground group'>
              <div className='flex items-center rounded-lg border-2 border-foreground/20 hover:border-foreground/50 transition-all p-1 px-2'>
                <Icon name={iconName} className='mr-2' />
                <span className='text-base'>{t(postType)}</span>
                <CreateButton />
              </div>
            </Link>
          )
        })}
        <Link to={createGroupModalUrl(location)} key='group' onClick={handleLinkClick} className='text-foreground transition-all hover:scale-105 hover:text-foreground group'>
          <div className='flex text-base items-center p-0 rounded-lg border-2 border-foreground/20 hover:border-foreground/50 transition-all p-1 px-2'>
            <Icon name='Groups' className='mr-2' />
            <span className='text-base'>{t('Group')}</span>
            <CreateButton />
          </div>
        </Link>
      </div>
    </div>
  )
}

const CreateButton = () => {
  const { t } = useTranslation()

  return <span className='text-xs text-selected/100 opacity-0 group-hover:opacity-100 transition-all absolute right-1 rounded-lg bg-selected/30 px-1 py-1'>{t('Create')}</span>
}
