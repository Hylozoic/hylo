import { BadgeDollarSign, Shapes } from 'lucide-react'
import React, { useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useLocation } from 'react-router-dom'
import { useDispatch, useSelector } from 'react-redux'
import Icon from 'components/Icon'
import useRouteParams from 'hooks/useRouteParams'
import { POST_TYPES } from 'store/models/Post'
import { RESP_MANAGE_TRACKS, RESP_MANAGE_ROUNDS } from 'store/constants'
import getGroupForSlug from 'store/selectors/getGroupForSlug'
import hasResponsibilityForGroup from 'store/selectors/hasResponsibilityForGroup'
import { toggleNavMenu } from 'routes/AuthLayoutRouter/AuthLayoutRouter.store'
import { createTrackUrl } from '@hylo/navigation'

const postTypes = Object.keys(POST_TYPES).filter(t => !['action', 'chat', 'submission'].includes(t))

export default function CreateMenu ({ coordinates, mapView }) {
  const routeParams = useRouteParams()
  const location = useLocation()
  const dispatch = useDispatch()
  const querystringParams = new URLSearchParams(location.search)
  const { t } = useTranslation()

  // Close the nav menu when a link is clicked
  const handleLinkClick = useCallback(() => {
    dispatch(toggleNavMenu(false))
  }, [dispatch])

  // Check whether currentUser has responsibility of administration for the current group
  const currentGroup = useSelector(state => getGroupForSlug(state, routeParams.groupSlug))
  const hasTracksResponsibility = useSelector(state => currentGroup && hasResponsibilityForGroup(state, { groupId: currentGroup.id, responsibility: RESP_MANAGE_TRACKS }))
  const hasRoundsResponsibility = useSelector(state => currentGroup && hasResponsibilityForGroup(state, { groupId: currentGroup.id, responsibility: RESP_MANAGE_ROUNDS }))


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
            <Link to={createPostForPostTypePath} key={postType} onClick={handleLinkClick} className='text-foreground transition-all hover:scale-105 hover:text-foreground group'>
              <div className='flex items-center rounded-lg border-2 border-foreground/20 hover:border-foreground/50 transition-all p-1 px-2'>
                <Icon name={iconName} className='mr-2' />
                <span className='text-base'>{t(postType)}</span>
                <CreateButton />
              </div>
            </Link>
          )
        })}
        {!mapView && hasTracksResponsibility && (
          <Link to={createTrackUrl(routeParams)} onClick={handleLinkClick} className='text-foreground transition-all hover:scale-105 hover:text-foreground group'>
            <div className='flex text-base items-center p-0 rounded-lg border-2 border-foreground/20 hover:border-foreground/50 transition-all p-1 px-2'>
              <Shapes className='mr-2' />
              <span className='text-base'>{t('Track')}</span>
              <CreateButton />
            </div>
          </Link>
        )}
        {!mapView && hasRoundsResponsibility && (
          <Link to={`${location.pathname}/create/funding-round`} onClick={handleLinkClick} className='text-foreground transition-all hover:scale-105 hover:text-foreground group'>
            <div className='flex text-base items-center p-0 rounded-lg border-2 border-foreground/20 hover:border-foreground/50 transition-all p-1 px-2'>
              <BadgeDollarSign className='mr-2' />
              <span className='text-base'>{t('Funding Round')}</span>
              <CreateButton />
            </div>
          </Link>
        )}
        {/* DEPRECATED: Now always allow group creation */}
        {/* {!isWebView() && ( */}
        <Link to='/create-group' key='group' onClick={handleLinkClick} className='text-foreground transition-all hover:scale-105 hover:text-foreground group'>
          <div className='flex text-base items-center p-0 rounded-lg border-2 border-foreground/20 hover:border-foreground/50 transition-all p-1 px-2'>
            <Icon name='Groups' className='mr-2' />
            <span className='text-base'>{t('Group')}</span>
            <CreateButton />
          </div>
        </Link>
        {/* )} */}
      </div>
    </div>
  )
}

const CreateButton = () => {
  const { t } = useTranslation()

  return <span className='text-xs text-selected/100 opacity-0 group-hover:opacity-100 transition-all absolute right-1 rounded-lg bg-selected/30 px-1 py-1'>{t('Create')}</span>
}
