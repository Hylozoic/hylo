import React, { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Expand, Link, Shrink, X } from 'lucide-react'
import isPlayableVideoUrl from 'util/isPlayableVideoUrl'
import Loading from 'components/Loading'
import { cn, bgImageStyle } from 'util/index'

/** Editor link preview: same card as PostCard, full width, with remove and featured-video controls. */
export default function LinkPreview ({ loading, featured: providedFeatured, ...props }) {
  const [isVideo, setIsVideo] = useState()
  const [featured, setFeatured] = useState()
  const { linkPreview, onClose, onFeatured, className } = props
  const url = linkPreview?.url || linkPreview?.ref?.url
  const { t } = useTranslation()

  const handleToggleFeatured = () => {
    setFeatured(!featured)
    onFeatured(!featured)
  }

  useEffect(() => {
    if (url) {
      const video = isPlayableVideoUrl(url)

      setIsVideo(video)

      if (typeof providedFeatured !== 'undefined') {
        setFeatured(providedFeatured)
      } else {
        setFeatured(video)
        onFeatured(video)
      }
    }
  }, [url, providedFeatured])

  if (loading && !linkPreview) return <Loading />

  const { title, description, imageUrl } = linkPreview || {}
  let domain = ''
  try {
    domain = url && new URL(url).hostname.replace('www.', '')
  } catch {
    domain = ''
  }

  return (
    <div className={cn('self-stretch mx-3 mt-2', className)}>
      {featured && (
        <div className='flex items-center text-xs rounded-t-lg p-2 bg-selected text-white'>
          <span><strong>{t('Featured:')}</strong> {t('This video will be full-width, displayed above the description, and playable.')}</span>
        </div>
      )}
      <div className={cn(
        'rounded-lg bg-card border border-foreground/10 p-2 flex items-center gap-2 shadow-lg text-foreground w-full',
        featured && 'rounded-t-none'
      )}
      >
        {imageUrl && (
          <div
            style={bgImageStyle(imageUrl)}
            className='relative self-stretch aspect-square min-h-16 w-16 shrink-0 bg-cover bg-center rounded-lg shadow-lg group'
          >
            {isVideo && (
              <button
                type='button'
                onClick={handleToggleFeatured}
                className='absolute inset-0 hidden group-hover:flex items-center justify-center bg-black/30 text-white cursor-pointer'
              >
                {featured
                  ? <Shrink className='w-6 h-6' />
                  : <Expand className='w-6 h-6' />}
              </button>
            )}
          </div>
        )}
        <div className='text-foreground p-2 min-w-0 flex-1'>
          <div className='flex items-start gap-2'>
            <div className='text-sm font-bold flex items-center gap-1 min-w-0 flex-1'>
              <Link className='w-3 h-3 shrink-0' />
              <span className='truncate'>{title}</span>
            </div>
            <button
              type='button'
              onClick={onClose}
              className='shrink-0 text-foreground/50 hover:text-foreground'
              aria-label={t('Remove')}
            >
              <X className='w-4 h-4' />
            </button>
          </div>
          {description && (
            <div className='text-xs line-clamp-2'>{description}</div>
          )}
          {domain && (
            <div className='text-xs text-foreground/50'>{domain}</div>
          )}
        </div>
      </div>
    </div>
  )
}
