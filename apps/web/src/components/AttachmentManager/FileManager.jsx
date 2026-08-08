import React, { useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { useDispatch } from 'react-redux'
import UploadAttachmentButton from 'components/UploadAttachmentButton'
import { FilePreview } from './FilePreview'
import { addAttachment, removeAttachment } from './AttachmentManager.store'

export function FileManager ({
  type, id, attachments, onChange, canRemove = true,
  uploadAttachmentPending, showLoading, showAddButton, showLabel
}) {
  const { t } = useTranslation()

  const dispatch = useDispatch()
  const handleRemoveAttachment = useCallback((attachment) => {
    dispatch(removeAttachment(type, id, attachment))
    if (onChange) onChange(attachments.filter(a => a.id !== attachment.id))
  }, [type, id, onChange, attachments])

  const handleAddAttachment = useCallback((attachment) => {
    dispatch(addAttachment(type, id, attachment))
    if (onChange) onChange(attachments.concat(attachment))
  }, [type, id, onChange, attachments])

  return (
    <div className='flex flex-col gap-2 border-t-2 border-dashed border-foreground/20 pt-4 px-4 w-full mx-2'>
      {showLabel && <div className='text-xs text-foreground/70'>{t('Files')}</div>}
      <div>
        {attachments.map((attachment, i) =>
          <FilePreview
            attachment={attachment}
            removeFile={canRemove && (() => handleRemoveAttachment(attachment))}
            key={i}
          />)}
        {showLoading && uploadAttachmentPending && (
          <div className='w-[100px] h-[30px] rounded mr-4 mb-4 text-center border-2 border-dashed border-border text-sm text-foreground/30 cursor-pointer mt-3 pt-1'>
            {t('Loading...')}
          </div>
        )}
        {showAddButton && (
          <UploadAttachmentButton
            id={id}
            type={type}
            attachmentType='file'
            onSuccess={handleAddAttachment}
            className='mt-3'
            allowMultiple
          >
            <div className='w-[100px] h-[30px] rounded mr-4 mb-4 text-center border-2 border-dashed border-border text-sm text-foreground/30 cursor-pointer'>
              <span className='text-[17px] mr-1'>+</span> {t('Add File')}
            </div>
          </UploadAttachmentButton>)}
      </div>
    </div>
  )
}
