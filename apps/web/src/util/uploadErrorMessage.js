// Code the backend's /noo/upload sends when the remote site refuses to let us download the file
export const REMOTE_DOWNLOAD_FAILED = 'REMOTE_DOWNLOAD_FAILED'

/**
 * The `code` from a failed /noo/upload response, or null. The error is the
 * rejected fetchJSON error (or a failed UPLOAD_ATTACHMENT action's payload),
 * whose response body is the backend's JSON ({ error, code }).
 */
export function uploadErrorCode (error) {
  const body = error?.response?.body
  if (typeof body !== 'string') return null
  try {
    return JSON.parse(body)?.code || null
  } catch (e) {
    return null
  }
}

/** True when the upload failed because the remote site refused the download, which isn't a bug. */
export function isRemoteDownloadFailure (error) {
  return uploadErrorCode(error) === REMOTE_DOWNLOAD_FAILED
}

/** A translated message telling the user why an upload failed. */
export function uploadErrorMessage (error, t) {
  if (isRemoteDownloadFailure(error)) {
    return t("We couldn't download that file. The site may not allow it. Try downloading it and uploading it directly.")
  }
  return t('Upload failed. Please try again.')
}
