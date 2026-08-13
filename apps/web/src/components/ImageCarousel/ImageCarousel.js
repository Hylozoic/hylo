import React, { useCallback, useEffect, useState } from 'react'
import PropTypes from 'prop-types'
import { useTranslation } from 'react-i18next'
import { filter, isEmpty } from 'lodash/fp'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from 'util/index'

/** Keeps a requested slide index inside the available images. */
function clampIndex (value, total) {
  const parsed = parseInt(value)
  if (!total || !Number.isFinite(parsed) || parsed < 0) return 0
  return Math.min(parsed, total - 1)
}

const NAV_BUTTON_CLASS = 'absolute top-1/2 -translate-y-1/2 grid place-items-center w-9 h-9 rounded-full bg-black/45 text-white backdrop-blur-sm transition-colors hover:bg-black/70 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/70'

/**
 * Lightbox image viewer: one image at a time, scaled to fit its container
 * without cropping, so the container alone decides how much room the image
 * gets. Arrow buttons and the Left/Right keys move between images.
 */
export default function ImageCarousel ({
  attachments,
  initialSlide = 0,
  className
}) {
  const { t } = useTranslation()
  const imageAttachments = filter({ type: 'image' }, attachments)
  const total = imageAttachments.length
  const [index, setIndex] = useState(() => clampIndex(initialSlide, total))

  // The viewer can stay mounted between openings, so follow the thumbnail that
  // was clicked rather than relying on a remount to pick up initialSlide.
  useEffect(() => {
    setIndex(clampIndex(initialSlide, total))
  }, [initialSlide, total])

  const go = useCallback(step => {
    setIndex(current => (current + step + total) % total)
  }, [total])

  useEffect(() => {
    if (total < 2) return undefined

    const handleKeydown = event => {
      if (event.key === 'ArrowLeft') go(-1)
      if (event.key === 'ArrowRight') go(1)
    }

    window.addEventListener('keydown', handleKeydown)
    return () => window.removeEventListener('keydown', handleKeydown)
  }, [go, total])

  if (isEmpty(imageAttachments)) return null

  return (
    <div className={cn('relative flex items-center justify-center w-full h-full', className)}>
      <img
        src={imageAttachments[index].url}
        alt={`Attached image ${index + 1}`}
        data-testid={`sc-img${index}`}
        className='max-w-full max-h-full w-auto h-auto object-contain rounded-lg shadow-xl'
      />
      {total > 1 && (
        <>
          <button
            type='button'
            className={cn(NAV_BUTTON_CLASS, 'left-0')}
            onClick={() => go(-1)}
            aria-label={t('Previous image')}
          >
            <ChevronLeft className='w-5 h-5' />
          </button>
          <button
            type='button'
            className={cn(NAV_BUTTON_CLASS, 'right-0')}
            onClick={() => go(1)}
            aria-label={t('Next image')}
          >
            <ChevronRight className='w-5 h-5' />
          </button>
          <div className='absolute bottom-0 left-1/2 -translate-x-1/2 rounded-full bg-black/45 px-2.5 py-0.5 text-xs font-semibold text-white backdrop-blur-sm'>
            {index + 1} / {total}
          </div>
        </>
      )}
    </div>
  )
}

ImageCarousel.propTypes = {
  attachments: PropTypes.array.isRequired,
  initialSlide: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
  className: PropTypes.string
}
