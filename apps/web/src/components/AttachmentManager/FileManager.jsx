import React, { useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { useDispatch } from 'react-redux'
import UploadAttachmentButton from 'components/UploadAttachmentButton'
import { FilePreview } from './FilePreview'
import { removeAttachment } from './AttachmentManager.store'

import classes from './AttachmentManager.module.scss'

export function FileManager ({
  type, id, attachments, addAttachment,
  uploadAttachmentPending, showLoading, showAddButton, showLabel
}) {
  const { t } = useTranslation()

  const dispatch = useDispatch()
  const handleRemoveAttachment = useCallback((attachment) => dispatch(removeAttachment(type, id, attachment)), [type, id])

  return (
    <div className={classes.fileManager}>
      {showLabel && <div className={classes.sectionLabel}>{t('Files')}</div>}
      <div className={classes.filePreviews}>
        {attachments.map((attachment, i) =>
          <FilePreview
            attachment={attachment}
            removeFile={() => handleRemoveAttachment(attachment)}
            key={i}
          />)}
        {showLoading && uploadAttachmentPending && <div className={classes.loadingFile}>{t('Loading...')}</div>}
        {showAddButton && (
          <UploadAttachmentButton
            id={id}
            type={type}
            attachmentType='file'
            onSuccess={attachment => addAttachment(type, id, attachment)}
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
