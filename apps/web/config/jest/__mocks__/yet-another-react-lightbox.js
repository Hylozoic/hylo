import React, { useEffect, useState } from 'react'

/**
 * Minimal Lightbox stand-in so Jest does not need the ESM package.
 * Mirrors the yarl class names and Next control used by CardImageAttachments tests.
 */
export default function Lightbox ({
  open,
  close,
  index = 0,
  slides = [],
  on
}) {
  const [currentIndex, setCurrentIndex] = useState(index)

  useEffect(() => {
    setCurrentIndex(index)
  }, [index])

  if (!open) return null

  const currentSlide = slides[currentIndex]

  const handleNext = () => {
    const nextIndex = Math.min(currentIndex + 1, slides.length - 1)
    setCurrentIndex(nextIndex)
    on?.view?.({ index: nextIndex })
  }

  return (
    <div className='yarl__root'>
      {currentSlide && (
        <div className='yarl__slide_current'>
          <img src={currentSlide.src} alt={currentSlide.alt || ''} />
        </div>
      )}
      <button aria-label='Next' type='button' onClick={handleNext}>
        Next
      </button>
      <button aria-label='Close' type='button' onClick={close}>
        Close
      </button>
    </div>
  )
}
