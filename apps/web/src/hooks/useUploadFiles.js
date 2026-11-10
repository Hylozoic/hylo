import { useCallback } from 'react'
import { useDispatch } from 'react-redux'
import { uploadFile, uploadedFileToAttachment } from 'client/filestack'
import { ID_FOR_NEW } from 'components/AttachmentManager/AttachmentManager.store'
import uploadAttachment from 'store/actions/uploadAttachment'

/**
 * Uploads dropped or pasted File objects the same way UploadAttachmentButton
 * does after the Filestack picker: Filestack first, then /noo/upload so the
 * backend stores its own copy. Calls `onUploaded` with each stored attachment
 * ({ url, attachmentType, ... }) as soon as it is ready.
 *
 * Resolves to { uploaded, failed } so callers can report failures.
 */
export default function useUploadFiles ({ type, id = ID_FOR_NEW }) {
  const dispatch = useDispatch()

  return useCallback(async (files, onUploaded = () => {}) => {
    const uploaded = []
    const failed = []

    for (const file of files) {
      try {
        const fileUploaded = await uploadFile(file)
        const attachment = uploadedFileToAttachment(fileUploaded)
        const response = await dispatch(uploadAttachment(type, id, attachment))
        if (!response || response.error || !response.payload?.url) {
          throw response?.payload || new Error('No response returned from uploader')
        }
        const stored = { ...attachment, ...response.payload }
        uploaded.push(stored)
        onUploaded(stored)
      } catch (error) {
        console.error('Error uploading file', file?.name, error)
        failed.push({ file, error })
      }
    }

    return { uploaded, failed }
  }, [dispatch, type, id])
}
