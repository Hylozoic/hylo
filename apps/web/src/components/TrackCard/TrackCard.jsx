import { Eye, EyeOff } from 'lucide-react'
import React from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import useRouteParams from 'hooks/useRouteParams'
import { trackUrl } from 'util/navigation'
import { cn } from 'util/index'

function TrackCard ({ track }) {
  const routeParams = useRouteParams()
  const { t } = useTranslation()

  const { name, numPeopleCompleted, numPeopleEnrolled, publishedAt } = track

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
        <div className='flex items-center gap-2'>
          <button
            className={cn(
              'p-2 rounded-md transition-colors',
              publishedAt ? 'bg-foreground/10' : 'bg-accent text-white'
            )}
            // onClick={() => updateField('publishedAt')(null)}
          >
            <EyeOff className='w-5 h-5' />
          </button>
          <button
            className={cn(
              'p-2 rounded-md transition-colors',
              publishedAt ? 'bg-accent text-white' : 'bg-foreground/10'
            )}
            // onClick={() => updateField('publishedAt')(new Date().toISOString())}
          >
            <Eye className='w-5 h-5' />
          </button>
          <span className='mr-2'>{publishedAt ? t('Published') : t('Unpublished')}</span>
        </div>
      </div>
    </div>
  )
}

export default TrackCard
