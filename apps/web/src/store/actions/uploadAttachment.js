import { UPLOAD_ATTACHMENT } from 'store/constants'

// `groupIds`: the groups a new post or comment is for, so the server applies their upload limit
// (lib/uploader/limits.js); for an existing post the server uses the post's groups
export default function uploadAttachment (type, id, attachment, { groupIds } = {}) {
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
          id,
          url,
          filename,
          ...(groupIds && groupIds.length > 0 ? { groupIds } : {})
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
