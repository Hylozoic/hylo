import { UPLOAD_ATTACHMENT } from 'store/constants'

/**
 * `id` is the attachment bucket the upload belongs to (used for pending state);
 * `uploadId` is the record id sent to the upload endpoint, when that differs.
 */
export default function uploadAttachment (type, id, attachment, uploadId = id) {
  const { url, filename, attachmentType } = attachment

  if (!url) return {}

  return {
    type: UPLOAD_ATTACHMENT,
    payload: {
      api: {
        method: 'post',
        path: '/noo/upload',
        params: {
          type,
          id: uploadId,
          url,
          filename
        }
      }
    },
    meta: {
      type,
      id,
      attachmentType
    }
  }
}
