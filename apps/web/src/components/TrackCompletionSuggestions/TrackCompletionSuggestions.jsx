import { Share2, Shapes } from 'lucide-react'
import React, { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useDispatch } from 'react-redux'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'
import { localSpaceSlug, spaceUrl } from '@hylo/navigation'
import Button from 'components/ui/button'
import { fetchTrackSuggestions } from 'store/actions/trackActions'
import { cn } from 'util/index'
import { suggestedTracks, trackShareUrl } from 'util/trackProgress'

/**
 * What comes after finishing a track (D33): other tracks in the parent group and a
 * way to share this one.
 */
export default function TrackCompletionSuggestions ({ parentGroup, space, className, onNavigate }) {
  const { t } = useTranslation()
  const dispatch = useDispatch()
  const [spaces, setSpaces] = useState(null)
  const parentId = parentGroup?.id
  const parentSlug = parentGroup?.slug

  useEffect(() => {
    if (!parentId) return
    let cancelled = false
    Promise.resolve(dispatch(fetchTrackSuggestions(parentId)))
      .then(result => {
        if (!cancelled) setSpaces(result?.payload?.data?.group?.spaces?.items || [])
      })
      .catch(() => { if (!cancelled) setSpaces([]) })
    return () => { cancelled = true }
  }, [dispatch, parentId])

  const shareUrl = trackShareUrl(parentSlug, space)
  const handleShare = useCallback(async () => {
    if (!shareUrl) return
    try {
      await navigator.clipboard.writeText(`${window.location.origin}${shareUrl}`)
      toast.success(t('Link copied'))
    } catch (e) {
      toast.error(t("Couldn't copy the link"))
    }
  }, [shareUrl, t])

  const suggestions = suggestedTracks(spaces, space?.id)

  return (
    <div className={cn('flex flex-col gap-3', className)} data-testid='track-completion-suggestions'>
      {suggestions.length > 0 && (
        <div className='flex flex-col gap-2'>
          <h4 className='m-0 text-sm font-bold text-foreground/80'>{t('Keep learning')}</h4>
          {suggestions.map(suggestion => (
            <Link
              key={suggestion.id}
              to={spaceUrl(parentSlug, localSpaceSlug(parentSlug, suggestion.slug))}
              onClick={onNavigate}
              className='flex flex-row items-center gap-2 rounded-md border-2 border-foreground/10 hover:border-selected/60 p-2 text-foreground hover:text-foreground transition-all'
            >
              <Shapes className='w-4 h-4 shrink-0 text-foreground/60' />
              <span className='flex-1 truncate'>{suggestion.name}</span>
              <span className='text-xs text-selected'>{suggestion.track.isEnrolled ? t('Continue') : t('Explore')}</span>
            </Link>
          ))}
        </div>
      )}
      {shareUrl && (
        <Button variant='outline' onClick={handleShare} className='self-start'>
          <Share2 className='w-4 h-4' /> {t('Share this track')}
        </Button>
      )}
    </div>
  )
}
