import { Eye, EyeOff, Settings, Users, UserCheck } from 'lucide-react'
import React, { useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { useDispatch, useSelector } from 'react-redux'
import { Link } from 'react-router-dom'
import Button from 'components/ui/button'
import useRouteParams from 'hooks/useRouteParams'
import { updateTrack } from 'store/actions/trackActions'
import getGroupForSlug from 'store/selectors/getGroupForSlug'
import hasResponsibilityForGroup from 'store/selectors/hasResponsibilityForGroup'
import { RESP_MANAGE_TRACKS } from 'store/constants'
import { trackUrl } from 'util/navigation'
import { cn } from 'util/index'
import Tooltip from 'components/Tooltip'

function TrackCard ({ track }) {
  const routeParams = useRouteParams()
  const { t } = useTranslation()
  const currentGroup = useSelector(state => getGroupForSlug(state, routeParams.groupSlug))
  const canEdit = useSelector(state => hasResponsibilityForGroup(state, { responsibility: RESP_MANAGE_TRACKS, groupId: currentGroup?.id }))
  const dispatch = useDispatch()

  const handlePublishTrack = useCallback((publishedAt) => {
    if (confirm(publishedAt ? t('Are you sure you want to publish this track?') : t('Are you sure you want to unpublish this track?'))) {
      dispatch(updateTrack({ trackId: track.id, publishedAt }))
    }
  }, [track.id])

  const { actionsName, name, numActions, numPeopleCompleted, numPeopleEnrolled, publishedAt } = track

  const handleButtonClick = (event) => {
    event.preventDefault(); // Prevents the click event from bubbling up to the Link
  };

  return (
    <Link className='text-foreground hover:text-foreground/100' to={`${trackUrl(track.id, routeParams)}`}>
      <div className='rounded-xl cursor-pointer p-2 flex flex-col transition-all bg-card/50 hover:bg-card/100 border-2 border-card/30 shadow-xl hover:shadow-lg relative hover:z-[2] hover:scale-101 duration-400'>
        <div className='flex justify-between items-center pb-1'>
          <div className='flex flex-row items-center gap-1'>
            <h2 className='text-base m-0 p-0 truncate'>{name}</h2>
            <span className='text-xs text-foreground/60 ml-2'>{t('{{num}} {{actionName}}', { num: numActions, actionName: actionsName })}</span>
          </div>
          {canEdit && <Link className='hover:scale-125 transition-all' to={`${trackUrl(track.id, routeParams)}?tab=edit`}><Settings className='w-6 h-6 cursor-pointer text-foreground' /></Link>}
        </div>
        <div className='flex justify-between items-center'>
          {canEdit && (
            <div className='flex items-center gap-2 bg-input p-2 rounded-md'>
              <Button
                className={cn(
                  'flex items-center justify-center rounded-md transition-colors w-8 h-8 transition-all',
                  publishedAt ? 'bg-foreground/10' : 'bg-accent text-white'
                )}
                onClick={(e) => { handleButtonClick(e); publishedAt ? handlePublishTrack(null) : null; }}
                tooltip={publishedAt ? t('Unpublish this track') : null}
              >
                <EyeOff className='w-5 h-5' />
              </Button>
              <Button
                className={cn(
                  'flex items-center justify-center rounded-md transition-colors w-8 h-8 transition-alls',
                  publishedAt ? 'bg-selected text-white' : 'bg-foreground/10'
                )}
                onClick={(e) => { handleButtonClick(e); publishedAt ? null : handlePublishTrack(new Date().toISOString()); }}
                tooltip={publishedAt ? null : t('Publish this track')}
              >
                <Eye className='w-5 h-5' />
              </Button>
              <span className={cn(
                'mr-2 text-xs',
                publishedAt ? 'text-selected' : 'text-accent'
              )}>{publishedAt ? t('Published') : t('Unpublished')}</span>
            </div>
          )}
          <div className='flex justify-between items-center flex-row gap-2'>
            <div className='flex flex-row items-center gap-1 border-2 border-focus/20 rounded-md p-1 px-2 hover:border-focus/100 transition-all cursor-pointer' data-tooltip-id='track-card-tooltip' data-tooltip-html={t('Number of people that have enrolled in the track')}>
              <span>{numPeopleEnrolled}</span>
              <span><Users className='w-4 h-4' /></span>
            </div>
            <div className='flex flex-row items-center gap-1 border-2 border-selected/20 rounded-md p-1 px-2 hover:border-selected/100 transition-all cursor-pointer' data-tooltip-id='track-card-tooltip' data-tooltip-html={t('Number of people that have completed the track')}>
              <span>{numPeopleCompleted}</span>
              <span className='text-xs'><UserCheck className='w-4 h-4' /></span>
            </div>
          </div>
        </div>
      </div>
      <Tooltip
        delay={0}
        id='track-card-tooltip'
        position='bottom'
      />
    </Link>
  )
}

export default TrackCard
