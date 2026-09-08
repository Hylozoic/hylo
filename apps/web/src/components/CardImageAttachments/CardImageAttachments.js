import React, { useMemo, useState } from 'react'
import PropTypes from 'prop-types'
import { filter, isEmpty } from 'lodash/fp'
import Lightbox from 'yet-another-react-lightbox'
import Zoom from 'yet-another-react-lightbox/plugins/zoom'
import Counter from 'yet-another-react-lightbox/plugins/counter'
import { bgImageStyle, cn } from 'util/index'
import 'yet-another-react-lightbox/styles.css'
import 'yet-another-react-lightbox/plugins/counter.css'

// Sit above PostDialog (overlay 100 / content 101) so the lightbox scrim dims
// the post when opened from inside PostDetail.
const LIGHTBOX_Z_INDEX = 150

export default function CardImageAttachments ({
  attachments = [],
  className,
  forChatPost = false,
  isFlagged
}) {
  const imageAttachments = useMemo(
    () => filter({ type: 'image' }, attachments),
    [attachments]
  )

  const firstImageUrl = imageAttachments?.[0]?.url
  const otherImageUrls = imageAttachments?.slice(1).map(ia => ia.url)

  const slides = useMemo(
    () => imageAttachments.map((image, index) => ({
      src: image.url,
      alt: `Attached image ${index + 1}`
    })),
    [imageAttachments]
  )

  const [lightboxIndex, setLightboxIndex] = useState(0)
  const [lightboxOpen, setLightboxOpen] = useState(false)

  const openLightbox = (e) => {
    if (className === 'post-card') return
    // A flagged image stays sealed: no lightbox until the viewer acknowledges
    // the flag cover (which clears isFlagged via clickthrough)
    if (isFlagged) return
    // Opening the lightbox must not also trigger surrounding click-to-open
    // handlers (a chat post opens its detail view on container clicks)
    e?.stopPropagation?.()
    setLightboxIndex(Number(e?.currentTarget?.dataset?.index) || 0)
    setLightboxOpen(true)
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
              {imageAttachments.map((image, index) => {
                const tileSrc = image.thumbnailUrl || image.url
                return (
                  <div key={image.id || image.url} className='relative w-[150px] h-[200px] rounded-md overflow-hidden border border-foreground/10 shrink-0'>
                    <div
                      data-index={index}
                      className={cn(
                        'absolute inset-0 cursor-pointer bg-cover bg-center hover:brightness-110',
                        isFlagged && 'blur-[30px] scale-110'
                      )}
                      style={bgImageStyle(tileSrc)}
                      role='img'
                      aria-label={image.url}
                      onClick={openLightbox}
                    />
                  </div>
                )
              })}
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
                  onClick={openLightbox}
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
                      onClick={openLightbox}
                    />
                  )}
                </div>
              </div>
            </>
            )}
      </div>
      <Lightbox
        open={lightboxOpen}
        close={() => setLightboxOpen(false)}
        index={lightboxIndex}
        slides={slides}
        plugins={[Zoom, Counter]}
        zoom={{
          scrollToZoom: true,
          maxZoomPixelRatio: 3
        }}
        controller={{ closeOnBackdropClick: true }}
        styles={{
          root: { zIndex: LIGHTBOX_Z_INDEX }
        }}
        on={{
          view: ({ index }) => setLightboxIndex(index)
        }}
      />
    </>
  )
}

CardImageAttachments.propTypes = {
  attachments: PropTypes.array,
  className: PropTypes.string,
  forChatPost: PropTypes.bool,
  isFlagged: PropTypes.bool
}
