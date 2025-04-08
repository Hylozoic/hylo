import { Eye, EyeOff } from 'lucide-react'
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

function TrackCard ({ track }) {
  const routeParams = useRouteParams()
  const { t } = useTranslation()
  const currentGroup = useSelector(state => getGroupForSlug(state, routeParams.groupSlug))
  const canEdit = useSelector(state => hasResponsibilityForGroup(state, { responsibility: RESP_MANAGE_TRACKS, groupId: currentGroup?.id }))
  const dispatch = useDispatch()

  const handlePublishTrack = useCallback((publishedAt) => {
    if (confirm(publishedAt ? t('Are you sure you want to publish this track?') : t('Are you sure you want to unpublish this track?'))) {
      dispatch(updateTrack(track.id, { publishedAt }))
    }
  }, [track.id])

  const { actionsName, name, numActions, numPeopleCompleted, numPeopleEnrolled, publishedAt } = track

  return (
    <div className='p-4 border rounded-lg'>
      <div className='flex justify-between items-center'>
        <Link to={trackUrl(track.id, routeParams)}><h2>{name}</h2></Link>
        <div className='flex justify-between items-center'>
          <span>{t('{{num}} Completed', { num: numPeopleCompleted })}</span> /
          <span>{t('{{num}} Enrolled', { num: numPeopleEnrolled })}</span>
        </div>
      </div>
      <div className='flex justify-between items-center'>
        {canEdit && (
          <div className='flex items-center gap-2'>
            <Button
              className={cn(
                'p-2 rounded-md transition-colors',
                publishedAt ? 'bg-foreground/10' : 'bg-accent text-white'
              )}
              onClick={() => publishedAt ? handlePublishTrack(null) : null}
              tooltip={publishedAt ? t('Unpublish this track') : null}
            >
              <EyeOff className='w-5 h-5' />
            </Button>
            <Button
              className={cn(
                'p-2 rounded-md transition-colors',
                publishedAt ? 'bg-accent text-white' : 'bg-foreground/10'
              )}
              onClick={() => publishedAt ? null : handlePublishTrack(new Date().toISOString())}
              tooltip={publishedAt ? null : t('Publish this track')}
            >
              <Eye className='w-5 h-5' />
            </Button>
            <span className='mr-2'>{publishedAt ? t('Published') : t('Unpublished')}</span>
          </div>
        )}
        <div className='flex-1' />
        <span>{t('{{num}} {{actionName}}', { num: numActions, actionName: actionsName })}</span>
      </div>
    </div>
  )
}

export default TrackCard
