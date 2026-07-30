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
const LIGHTBOX_CLASS = 'left-0 top-0 translate-x-0 translate-y-0 flex items-center justify-center w-screen h-screen max-w-none gap-0 p-10 bg-transparent shadow-none border-none text-white touch-none'
// Matches PostDialog's backdrop so both dialogs dim the page the same way.
const LIGHTBOX_OVERLAY_CLASS = 'bg-darkening/50 dark:bg-darkening/90 backdrop-blur-sm'

// Drag-to-dismiss: either a long enough drag, or a quick flick in any direction.
const DISMISS_DISTANCE_PX = 110
const DISMISS_VELOCITY_PX_PER_MS = 0.5
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

  // Vertical offset while dragging the open image, and the in-progress gesture
  const [dragY, setDragY] = useState(0)
  const [dragging, setDragging] = useState(false)
  const dragRef = useRef(null)

  const openModal = (e) => {
    if (className === 'post-card') return
    setInitialSlide(e?.currentTarget?.dataset?.index || 0)
    setDragY(0)
    setModalVisible(true)
  }

  // The lightbox fills the viewport, so there is no Radix overlay left to click
  // through — close on any click that misses the image and its controls.
  const handleLightboxClick = (e) => {
    if (e.target.tagName === 'IMG' || e.target.closest('button')) return
    setModalVisible(false)
  }

  const handleTouchStart = (e) => {
    if (e.touches.length !== 1) return
    const touch = e.touches[0]
    dragRef.current = { x: touch.clientX, y: touch.clientY, at: e.timeStamp, locked: false }
  }

  const handleTouchMove = (e) => {
    const drag = dragRef.current
    if (!drag || e.touches.length !== 1) return
    const touch = e.touches[0]
    const dy = touch.clientY - drag.y
    const dx = touch.clientX - drag.x

    if (!drag.locked) {
      if (Math.abs(dy) < DRAG_SLOP_PX && Math.abs(dx) < DRAG_SLOP_PX) return
      // Only claim clearly vertical gestures; anything else is left alone
      if (Math.abs(dy) <= Math.abs(dx)) {
        dragRef.current = null
        return
      }
      drag.locked = true
      setDragging(true)
    }

    setDragY(dy)
  }

  const handleTouchEnd = (e) => {
    const drag = dragRef.current
    dragRef.current = null
    setDragging(false)
    if (!drag?.locked) return

    const elapsed = Math.max(1, e.timeStamp - drag.at)
    const flicked = Math.abs(dragY) / elapsed > DISMISS_VELOCITY_PX_PER_MS
    if (Math.abs(dragY) > DISMISS_DISTANCE_PX || flicked) {
      setModalVisible(false)
      return
    }
    // Fell short — spring back
    setDragY(0)
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
              {imageAttachments.map((image, index) =>
                <div
                  key={image.url}
                  data-index={index}
                  className='block w-[150px] h-[200px] cursor-pointer rounded-md bg-cover bg-center border border-foreground/10 hover:brightness-110'
                  style={bgImageStyle(image.url)}
                  role='img'
                  aria-label={image.url}
                  onClick={openModal}
                />
              )}
            </div>
            )
          : (
            <>
              <img
                src={firstImageUrl}
                alt='Attached image 1'
                className='block mx-auto my-0 w-full h-auto max-h-[500px] object-cover rounded-xl shadow-2xl cursor-pointer'
                data-index={0}
                onClick={openModal}
                data-testid='first-image'
              />
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
          <div
            className='w-full h-full'
            style={{
              transform: dragY ? `translateY(${dragY}px)` : undefined,
              // Fades out as it travels, so a drag reads as dismissing rather than scrolling
              opacity: dragY ? Math.max(0.3, 1 - Math.abs(dragY) / 420) : undefined,
              transition: dragging ? 'none' : 'transform 200ms ease-out, opacity 200ms ease-out'
            }}
          >
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
