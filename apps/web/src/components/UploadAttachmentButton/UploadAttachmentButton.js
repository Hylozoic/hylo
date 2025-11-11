import React, { useState } from 'react'
import PropTypes from 'prop-types'
import { useTranslation } from 'react-i18next'
import { useDispatch } from 'react-redux'
import {
  uploadedFileToAttachment,
  filestackPicker
} from 'client/filestack'
import { ID_FOR_NEW } from 'components/AttachmentManager/AttachmentManager.store'
import Icon from 'components/Icon'
import uploadAttachment from 'store/actions/uploadAttachment'
import { cn } from 'util/index'

import classes from './UploadAttachmentButton.module.scss'

export default function UploadAttachmentButton ({
  type,
  id = ID_FOR_NEW,
  attachmentType,
  onInitialUpload, // If set then we won't upload the file to the server, we'll call this instead
  onSuccess,
  onError = () => {},
  customRender,
  allowMultiple,
  disable,
  maxFiles = 1,
  // passed to customRender
  ...uploadButtonProps
}) {
  const [loading, setLoading] = useState(false)
  const { t } = useTranslation()
  const dispatch = useDispatch()

  const uploadAttachmentComplete = response => {
    if (!response) {
      return onError(new Error('No response returned from uploader'))
    }
    if (response.error) return onError(response.error)
    if (response.payload) return onSuccess(response.payload)
  }

  // Filestack callbacks

  const onFileUploadFinished = async fileUploaded => {
    const attachment = uploadedFileToAttachment({ ...fileUploaded, attachmentType })
    if (onInitialUpload) {
      // If set then we won't upload the file to the server, we'll call this instead
      onInitialUpload(attachment)
    } else {
      const uploadedAttachment = await dispatch(uploadAttachment(type, id, attachment))
      return uploadAttachmentComplete(uploadedAttachment)
    }
  }

  const onUploadDone = async ({ filesUploaded }) => {
    for (const filestackFileObject of filesUploaded) {
      await onFileUploadFinished(filestackFileObject)
    }
    setLoading(false)
  }

  const onCancel = () => setLoading(false)

  const onClick = () => {
    setLoading(true)
    filestackPicker({
      attachmentType,
      maxFiles: allowMultiple ? 10 : 1,
      onUploadDone,
      onCancel,
      t
    }).open()
  }

  const renderProps = {
    onClick: disable || loading
      ? () => {}
      : onClick,
    disable,
    loading,
    ...uploadButtonProps
  }

  if (customRender) return customRender(renderProps)

  return <UploadButton {...renderProps} />
}

UploadAttachmentButton.propTypes = {
  type: PropTypes.string.isRequired,
  id: PropTypes.string,
  attachmentType: PropTypes.string, // for useFilestackLibrary
  onInitialUpload: PropTypes.func,
  onSuccess: PropTypes.func,
  onError: PropTypes.func,
  customRender: PropTypes.func,
  allowMultiple: PropTypes.bool,
  disable: PropTypes.bool,
  loading: PropTypes.bool
}

function UploadButton ({
  onClick,
  loading,
  className,
  iconName = 'AddImage',
  children
}) {
  const loadingIconName = loading ? 'Clock' : iconName

  return (
    <div onClick={onClick} className={cn(className, 'cursor-pointer')} data-testid='upload-attachment-button'>
      {children && children}
      {!children && <Icon name={loadingIconName} className={cn(classes.icon)} />}
    </div>
  )
}
