import React, { useRef, useState } from 'react'
import PropTypes from 'prop-types'
import { useTranslation } from 'react-i18next'
import { filter, isEmpty } from 'lodash/fp'
import { Dialog, DialogContent, DialogTitle } from 'components/ui/dialog'
import ImageCarousel from 'components/ImageCarousel'
import { bgImageStyle, cn } from 'util/index'

// The lightbox is the full viewport with no panel behind it, so the image is
// bounded only by the viewport. The padding is what keeps the image clear of
// the dialog's close button (top-right, inset 1rem) and gives the surrounding
// scrim something to click on. touch-none keeps a drag-to-dismiss from also
// scrolling the page behind it.
// text-white is inherited by the dialog's close button, which now sits on the
// scrim rather than on a panel.
// z sits above PostDialog (overlay 100 / content 101) so the scrim actually
// dims the post when the lightbox opens from inside it
const LIGHTBOX_CLASS = 'left-0 top-0 translate-x-0 translate-y-0 z-[151] flex items-center justify-center w-screen h-screen max-w-none gap-0 p-10 bg-transparent shadow-none border-none text-white touch-none'
// Matches PostDialog's backdrop so both dialogs dim the page the same way.
// The class is also the handle the drag gesture uses to dim it, mirroring how
// PostDetail reaches for .PostDialog-Overlay.
const LIGHTBOX_OVERLAY_CLASS = 'ImageLightbox-Overlay z-[150] bg-darkening/50 dark:bg-darkening/90 backdrop-blur-sm'

// Drag-to-dismiss constants are lifted from PostDetail's pull-to-close so the
// lightbox and the post dialog feel identical: the raw drag is dampened, and
// the dampened distance (not the raw one) is what has to clear the threshold.
const PULL_THRESHOLD = 100
const DRAG_DAMPING = 0.45
// Slack before a touch counts as a drag, so taps still register as clicks.
const DRAG_SLOP_PX = 8

export default function CardImageAttachments ({
  attachments = [],
  className,
  forChatPost = false,
  isFlagged
}) {
  const { t } = useTranslation()
  const imageAttachments = filter({ type: 'image' }, attachments)

  const firstImageUrl = imageAttachments?.[0]?.url
  const otherImageUrls = imageAttachments?.slice(1).map(ia => ia.url)

  const [initialSlide, setInitialSlide] = useState(0)
  const [modalVisible, setModalVisible] = useState(false)

  // The dragged element and the in-progress gesture. Styles are written straight
  // to the node during a drag (as PostDetail does) rather than through state, so
  // touchmove doesn't re-render on every frame.
  const dragTargetRef = useRef(null)
  const dragRef = useRef(null)

  const openModal = (e) => {
    if (className === 'post-card') return
    // Opening the lightbox must not also trigger surrounding click-to-open
    // handlers (a chat post opens its detail view on container clicks)
    e?.stopPropagation?.()
    setInitialSlide(e?.currentTarget?.dataset?.index || 0)
    setModalVisible(true)
  }

  // The lightbox fills the viewport, so there is no Radix overlay left to click
  // through — close on any click that misses the image and its controls.
  const handleLightboxClick = (e) => {
    if (e.target.tagName === 'IMG' || e.target.closest('button')) return
    setModalVisible(false)
  }

  const overlayEl = () => document.querySelector('.ImageLightbox-Overlay')

  const resetDragStyles = () => {
    const target = dragTargetRef.current
    if (target) {
      target.style.transform = ''
      target.style.opacity = ''
      target.style.willChange = ''
    }
    const overlay = overlayEl()
    if (overlay) {
      overlay.style.backgroundColor = ''
      overlay.style.backdropFilter = ''
    }
  }

  const applyDragStyles = (dampened, progress, direction) => {
    const target = dragTargetRef.current
    if (!target) return
    target.style.transform = `translateY(${direction === 'down' ? dampened : -dampened}px) scale(${Math.max(1 - progress * 0.04, 0.92)})`
    target.style.opacity = Math.max(1 - progress * 0.4, 0.3)
    target.style.willChange = 'transform, opacity'

    const overlay = overlayEl()
    if (overlay) {
      overlay.style.backgroundColor = `rgba(0, 0, 0, ${Math.max(1 - progress * 0.6, 0.1) * 0.5})`
      overlay.style.backdropFilter = `blur(${Math.max(12 - progress * 8, 0)}px)`
    }
  }

  const handleTouchStart = (e) => {
    if (e.touches.length !== 1) return
    dragRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY, locked: false }
  }

  const handleTouchMove = (e) => {
    const drag = dragRef.current
    if (!drag || e.touches.length !== 1) return
    const rawDelta = e.touches[0].clientY - drag.y
    const dx = e.touches[0].clientX - drag.x

    if (!drag.locked) {
      if (Math.abs(rawDelta) < DRAG_SLOP_PX && Math.abs(dx) < DRAG_SLOP_PX) return
      // Only claim clearly vertical gestures; anything else is left alone
      if (Math.abs(rawDelta) <= Math.abs(dx)) {
        dragRef.current = null
        return
      }
      drag.locked = true
      const target = dragTargetRef.current
      if (target) target.style.transition = ''
    }

    const dampened = Math.abs(rawDelta) * DRAG_DAMPING
    applyDragStyles(dampened, Math.min(dampened / PULL_THRESHOLD, 1.5), rawDelta > 0 ? 'down' : 'up')
  }

  const handleTouchEnd = (e) => {
    const drag = dragRef.current
    dragRef.current = null
    if (!drag?.locked) return

    const rawDelta = e.changedTouches[0].clientY - drag.y
    const dampened = Math.abs(rawDelta) * DRAG_DAMPING
    const target = dragTargetRef.current

    if (dampened >= PULL_THRESHOLD && target) {
      // Carry on out of frame, then close once the animation has mostly played
      target.style.transition = 'transform 0.25s ease-out, opacity 0.25s ease-out'
      target.style.transform = `translateY(${rawDelta > 0 ? '60vh' : '-60vh'}) scale(0.9)`
      target.style.opacity = '0'
      const overlay = overlayEl()
      if (overlay) {
        overlay.style.transition = 'background-color 0.25s ease-out, backdrop-filter 0.25s ease-out'
        overlay.style.backgroundColor = 'transparent'
        overlay.style.backdropFilter = 'blur(0px)'
      }
      setTimeout(() => setModalVisible(false), 200)
      return
    }

    // Fell short — spring back
    if (target) target.style.transition = 'transform 0.3s cubic-bezier(0.2, 0.9, 0.3, 1), opacity 0.3s ease'
    const overlay = overlayEl()
    if (overlay) overlay.style.transition = 'background-color 0.3s ease, backdrop-filter 0.3s ease'
    resetDragStyles()
  }

  if (isEmpty(imageAttachments)) return null
  if (!firstImageUrl) return null

  return (
    <>
      <div
        className={cn(
          className,
          'relative [&_img]:cursor-pointer',
          forChatPost && 'flex overflow-x-auto overflow-y-hidden h-[200px] ml-[42px] mt-3 mb-3',
          isFlagged && !forChatPost && 'overflow-hidden',
          isFlagged && '[&_img]:blur-[30px]'
        )}
      >
        {forChatPost
          ? (
            <div className='flex flex-row gap-2'>
              {/* Chat tiles are background-image divs, not <img>, so the
                  [&_img] blur above can't reach them — blur inside a clipping
                  wrapper instead (scale hides the blur's transparent edges) */}
              {imageAttachments.map((image, index) =>
                <div key={image.url} className='relative w-[150px] h-[200px] rounded-md overflow-hidden border border-foreground/10 shrink-0'>
                  <div
                    data-index={index}
                    className={cn(
                      'absolute inset-0 cursor-pointer bg-cover bg-center hover:brightness-110',
                      isFlagged && 'blur-[30px] scale-110'
                    )}
                    style={bgImageStyle(image.url)}
                    role='img'
                    aria-label={image.url}
                    onClick={openModal}
                  />
                </div>
              )}
            </div>
            )
          : (
            <>
              {/* The full image always shows (object-contain), capped at half the
                  screen. When the cap letterboxes it, the same image fills the
                  gap as a blurred, darkened cover instead of an awkward crop. */}
              <div className='relative overflow-hidden rounded-xl shadow-2xl'>
                <div aria-hidden='true' className='absolute inset-0 bg-cover bg-center scale-110 blur-2xl' style={bgImageStyle(firstImageUrl)} />
                <div aria-hidden='true' className='absolute inset-0 bg-black/40' />
                <img
                  src={firstImageUrl}
                  alt='Attached image 1'
                  className='relative block mx-auto my-0 w-full h-auto max-h-[50vh] object-contain cursor-pointer'
                  data-index={0}
                  onClick={openModal}
                  data-testid='first-image'
                />
              </div>
              <div className='absolute w-full bottom-[15px] right-0 flex overflow-x-auto py-2.5 pl-2 cursor-pointer'>
                <div className='flex flex-row ml-auto'>
                  {!isEmpty(otherImageUrls) && otherImageUrls.map((url, index) =>
                    <img
                      className='block border-2 border-card w-auto h-20 rounded-sm mr-5 object-cover shadow-lg shadow-foreground/60 hover:brightness-110 cursor-pointer'
                      data-index={index + 1}
                      src={url}
                      alt={`Attached image ${index + 2}`}
                      key={index}
                      onClick={openModal}
                    />
                  )}
                </div>
              </div>
            </>
            )}
      </div>
      <Dialog open={modalVisible} onOpenChange={setModalVisible}>
        {/* aria-describedby opts out of Radix's description warning — the image is the content */}
        <DialogContent
          className={LIGHTBOX_CLASS}
          overlayClassName={LIGHTBOX_OVERLAY_CLASS}
          onClick={handleLightboxClick}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          onTouchCancel={handleTouchEnd}
          aria-describedby={undefined}
        >
          <DialogTitle className='sr-only'>{t('Image viewer')}</DialogTitle>
          <div ref={dragTargetRef} className='w-full h-full'>
            <ImageCarousel attachments={imageAttachments} initialSlide={initialSlide} />
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}

CardImageAttachments.propTypes = {
  attachments: PropTypes.array,
  className: PropTypes.string,
  forChatPost: PropTypes.bool,
  isFlagged: PropTypes.bool
}
