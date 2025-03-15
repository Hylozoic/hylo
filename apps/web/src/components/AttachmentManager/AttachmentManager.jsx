import React, { useEffect, useCallback } from 'react'
import PropTypes from 'prop-types'
import { useSelector, useDispatch } from 'react-redux'
import { isEmpty, filter } from 'lodash/fp'
import {
  clearAttachments,
  setAttachments,
  getAttachments,
  getAttachmentsFromObject,
  getUploadAttachmentPending,
  ID_FOR_NEW
} from './AttachmentManager.store'
import { ImageManager } from './ImageManager'
import { FileManager } from './FileManager'

function AttachmentManager (props) {
  const {
    type,
    id = ID_FOR_NEW,
    attachmentType,
    showLoading,
    onChange
  } = props

  const dispatch = useDispatch()
  const uploadAttachmentPending = useSelector(state => getUploadAttachmentPending(state, props))
  const attachments = useSelector(state => getAttachments(state, props))
  const attachmentsFromObject = useSelector(state => getAttachmentsFromObject(state, props))

  const loadAttachments = useCallback(() => dispatch(setAttachments(type, id, attachmentType, attachmentsFromObject)), [type, id, attachmentType])
  const clearAttachmentsAction = useCallback(() => dispatch(clearAttachments(type, id, attachmentType)), [type, id, attachmentType])

  useEffect(() => {
    loadAttachments()

    return () => {
      clearAttachmentsAction()
    }
  }, [loadAttachments])

  useEffect(() => {
    if (!isEmpty(props.attachmentsFromObject)) {
      loadAttachments()
    }
  }, [attachmentsFromObject, loadAttachments])

  if (isEmpty(attachments) && !uploadAttachmentPending) return null

  const imageAttachments = filter({ attachmentType: 'image' }, attachments)
  const fileAttachments = filter({ attachmentType: 'file' }, attachments)
  const showImages = (!isEmpty(imageAttachments) || (uploadAttachmentPending && showLoading)) &&
    (!attachmentType || attachmentType === 'image')
  const showFiles = (!isEmpty(fileAttachments) || (uploadAttachmentPending && showLoading)) &&
    (!attachmentType || attachmentType === 'file')

  return (
    <>
      {showImages &&
        <ImageManager {...props} showLoading={showLoading} attachments={imageAttachments} onChange={onChange} />}
      {showFiles &&
        <FileManager {...props} showLoading={showLoading} attachments={fileAttachments} onChange={onChange} />}
    </>
  )
}

AttachmentManager.propTypes = {
  type: PropTypes.string.isRequired,
  id: PropTypes.string,
  attachmentType: PropTypes.string,
  showAddButton: PropTypes.bool,
  showLabel: PropTypes.bool,
  showLoading: PropTypes.bool,
  onChange: PropTypes.func
}

export default AttachmentManager
