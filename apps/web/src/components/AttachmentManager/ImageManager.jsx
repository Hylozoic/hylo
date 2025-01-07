import React, { useCallback, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useDispatch } from 'react-redux'
import { SortableContext, horizontalListSortingStrategy } from '@dnd-kit/sortable'
import { DndContext } from '@dnd-kit/core'
import Loading from 'components/Loading'
import { ImagePreview } from './ImagePreview'
import UploadAttachmentButton from 'components/UploadAttachmentButton'
import { moveAttachment } from './AttachmentManager.store'

import classes from './AttachmentManager.module.scss'

export function ImageManager (props) {
  const { t } = useTranslation()
  const {
    type, id, attachments, addAttachment, removeAttachment,
    uploadAttachmentPending, showLoading, showAddButton, showLabel
  } = props

  const dispatch = useDispatch()
  const switchImages = useCallback((position1, position2) => dispatch(moveAttachment(type, id, 'image', position1, position2)), [type, id])

  const handleDragEnd = useCallback(({ active, over }) => {
    if (active.id !== over.id) {
      switchImages(active.data.current.sortable.index, over.data.current.sortable.index)
    }
  }, [switchImages])

  const images = useMemo(() => attachments.map((attachment, i) => ({
    ...attachment,
    id: attachment.url
  })), [attachments])

  return (
    <DndContext onDragEnd={handleDragEnd}>
      <SortableContext items={images} strategy={horizontalListSortingStrategy}>
        <div className={classes.imageManager}>
          {showLabel && <div className={classes.sectionLabel}>{t('Images')}</div>}
          <div className={classes.imagePreviews}>
            {images.map((attachment, i) =>
              <ImagePreview
                attachment={attachment}
                removeImage={() => removeAttachment(type, id, attachment)}
                index={i}
                key={i}
              />)}
            {showLoading && uploadAttachmentPending && <div className={classes.addImage}><Loading /></div>}
            {showAddButton && (
              <UploadAttachmentButton
                type={type}
                id={id}
                attachmentType='image'
                onSuccess={attachment => addAttachment(type, id, attachment)}
              >
                <div className={classes.addImage}>+</div>
              </UploadAttachmentButton>)}
          </div>
        </div>
      </SortableContext>
    </DndContext>
  )
}
