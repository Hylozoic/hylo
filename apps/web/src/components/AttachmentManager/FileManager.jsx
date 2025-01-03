import React from 'react'
import { useTranslation } from 'react-i18next'
import UploadAttachmentButton from 'components/UploadAttachmentButton'
import { FilePreview } from './FilePreview'

import classes from './AttachmentManager.module.scss'

export function FileManager ({
  type, id, attachments, addAttachment, removeAttachment,
  uploadAttachmentPending, showLoading, showAddButton, showLabel
}) {
  const { t } = useTranslation()

  return (
    <div className={classes.fileManager}>
      {showLabel && <div className={classes.sectionLabel}>{t('Files')}</div>}
      <div className={classes.filePreviews}>
        {attachments.map((attachment, i) =>
          <FilePreview
            attachment={attachment}
            removeFile={() => removeAttachment(type, id, attachment)}
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
          >
            <div className={classes.addFile}>
              <span className={classes.addFilePlus}>+</span> {t('Add File')}
            </div>
          </UploadAttachmentButton>)}
      </div>
    </div>
  )
}
