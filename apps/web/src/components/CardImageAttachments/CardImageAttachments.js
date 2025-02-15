import React, { useState } from 'react'
import PropTypes from 'prop-types'
import { filter, isEmpty } from 'lodash/fp'
import ModalDialog from 'components/ModalDialog'
import ImageCarousel from 'components/ImageCarousel'
import { bgImageStyle, cn } from 'util/index'

import classes from './CardImageAttachments.module.scss'

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
      <div className={cn(className, classes.images, { [classes.chatPost]: forChatPost, [classes.flagged]: isFlagged })}>
        {forChatPost
          ? (
            <div className={classes.imagesInner}>
              {imageAttachments.map((image, index) =>
                <div key={image.url} data-index={index} className={classes.image} style={bgImageStyle(image.url)} role='img' aria-label={image.url} onClick={toggleModal} />
              )}
            </div>
            )
          : (
            <>
              <img
                src={firstImageUrl}
                alt='Attached image 1'
                data-index={0}
                onClick={toggleModal}
                data-testid='first-image'
                style={{
                  maxHeight: '500px',
                  width: '100%',
                  height: 'auto',
                  display: 'block',
                  margin: '0 auto',
                  objectFit: 'cover'
                }}
              />
              <div className={classes.others}>
                <div className={classes.othersInner}>
                  {!isEmpty(otherImageUrls) && otherImageUrls.map((url, index) =>
                    <img
                      className={classes.other}
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
