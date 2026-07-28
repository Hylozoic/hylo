import React, { useState } from 'react'
import PropTypes from 'prop-types'
import { filter, isEmpty } from 'lodash/fp'
import ModalDialog from 'components/ModalDialog'
import ImageCarousel from 'components/ImageCarousel'
import { bgImageStyle, cn } from 'util/index'

export default function CardImageAttachments ({
  attachments = [],
  className,
  forChatPost = false,
  isFlagged
}) {
  const imageAttachments = filter({ type: 'image' }, attachments)

  const firstImageUrl = imageAttachments?.[0]?.url
  const otherImageUrls = imageAttachments?.slice(1).map(ia => ia.url)

  const [initialSlide, setInitialSlide] = useState(0)
  const [modalVisible, setModalVisible] = useState(false)

  const toggleModal = (e) => {
    if (className === 'post-card') return
    setInitialSlide(e?.target.dataset.index || 0)
    setModalVisible(!modalVisible)
  }

  const modalSettings = {
    showCancelButton: false,
    submitButtonText: 'Close',
    showModalTitle: false,
    closeModal: toggleModal,
    style: { width: '100%', maxWidth: '1024px' }
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
                  onClick={toggleModal}
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
                onClick={toggleModal}
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
                      onClick={toggleModal}
                    />
                  )}
                </div>
              </div>
            </>
            )}
      </div>
      {modalVisible && (
        <ModalDialog {...modalSettings}>
          <ImageCarousel attachments={imageAttachments} initialSlide={initialSlide} />
        </ModalDialog>
      )}
    </>
  )
}

CardImageAttachments.propTypes = {
  attachments: PropTypes.array,
  className: PropTypes.string,
  forChatPost: PropTypes.bool,
  isFlagged: PropTypes.bool
}
