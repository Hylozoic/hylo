import React from 'react'
import Icon from 'components/Icon'
import classes from './AttachmentManager.module.scss'

export function FilePreview ({ attachment, removeFile, fileSize }) {
  const filename = new URL(attachment.url).pathname.split('/').pop()
  return (
    <div className={classes.filePreview}>
      <Icon name='Document' className={classes.iconDocument} />
      <div className={classes.fileName}>{decodeURIComponent(filename)}</div>
      {fileSize && <div className={classes.fileSize}>{fileSize}</div>}
      <Icon name='Ex' className={classes.removeFile} onClick={removeFile} />
    </div>
  )
}
