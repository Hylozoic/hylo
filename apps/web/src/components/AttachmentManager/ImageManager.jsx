import React, { useCallback, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useDispatch } from 'react-redux'
import { SortableContext, horizontalListSortingStrategy } from '@dnd-kit/sortable'
import { DndContext } from '@dnd-kit/core'
import Loading from 'components/Loading'
import { ImagePreview } from './ImagePreview'
import UploadAttachmentButton from 'components/UploadAttachmentButton'
import { addAttachment, moveAttachment, removeAttachment } from './AttachmentManager.store'

import classes from './AttachmentManager.module.scss'

export function ImageManager (props) {
  const { t } = useTranslation()
  const {
    type, id, attachments, onChange,
    uploadAttachmentPending, showLoading, showAddButton, showLabel
  } = props

  const dispatch = useDispatch()
  const switchImages = useCallback((position1, position2) => {
    dispatch(moveAttachment(type, id, 'image', position1, position2))
    if (onChange) onChange(position1, position2)
  }, [type, id, onChange])

  const handleRemoveAttachment = useCallback((attachment) => {
    dispatch(removeAttachment(type, id, attachment))
    if (onChange) onChange(attachment)
  }, [type, id, onChange])

  const handleAddAttachment = useCallback((attachment) => {
    dispatch(addAttachment(type, id, attachment))
    if (onChange) onChange(attachment)
  }, [type, id, onChange])

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
        <div className='flex flex-col gap-2 border-t-2 border-dashed border-foreground/20 pt-4 px-4 w-full mx-2'>
          {showLabel && <div className='text-xs text-foreground/70'>{t('Images')}</div>}
          <div className={classes.imagePreviews}>
            {images.map((attachment, i) =>
              <ImagePreview
                attachment={attachment}
                removeImage={() => handleRemoveAttachment(attachment)}
                index={i}
                key={i}
              />)}
            {showLoading && uploadAttachmentPending && <div className={classes.addImage}><Loading /></div>}
            {showAddButton && (
              <UploadAttachmentButton
                type={type}
                id={id}
                attachmentType='image'
                onSuccess={handleAddAttachment}
                allowMultiple
              >
                <div className={classes.addImage}>+</div>
              </UploadAttachmentButton>)}
          </div>
        </div>
      </SortableContext>
    </DndContext>
  )
}
