import React, { useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { useDispatch } from 'react-redux'
import UploadAttachmentButton from 'components/UploadAttachmentButton'
import { FilePreview } from './FilePreview'
import { addAttachment, removeAttachment } from './AttachmentManager.store'

import classes from './AttachmentManager.module.scss'

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
    <div className={classes.fileManager}>
      {showLabel && <div className={classes.sectionLabel}>{t('Files')}</div>}
      <div className={classes.filePreviews}>
        {attachments.map((attachment, i) =>
          <FilePreview
            attachment={attachment}
            removeFile={canRemove && (() => handleRemoveAttachment(attachment))}
            key={i}
          />)}
        {showLoading && uploadAttachmentPending && <div className={classes.loadingFile}>{t('Loading...')}</div>}
        {showAddButton && (
          <UploadAttachmentButton
            id={id}
            type={type}
            attachmentType='file'
            onSuccess={handleAddAttachment}
            className={classes.addFileRow}
            allowMultiple
          >
            <div className={classes.addFile}>
              <span className={classes.addFilePlus}>+</span> {t('Add File')}
            </div>
          </UploadAttachmentButton>)}
      </div>
    </div>
  )
}
