/**
 * Attachment upload size limits (#1761). The one place these numbers live: the backend enforces
 * them (lib/uploader), the web shows them in the file picker and drop-zone copy and checks files
 * before uploading. A Pro Plus limit (the `higherUploadLimits` feature) is one more constant here.
 */

export const MB = 1024 * 1024
export const GB = 1024 * MB

// Every upload: the limit the Filestack picker has always enforced on the web
export const FREE_UPLOAD_LIMIT_BYTES = 50 * MB
// Uploads to groups with the Hylo Pro `largerUploads` feature
export const PRO_UPLOAD_LIMIT_BYTES = 1 * GB

/**
 * The per-file limit for an upload, from the Pro features of the group(s) it is for.
 *
 * @param {{ largerUploads?: boolean }} features
 * @returns {number} bytes
 */
export function uploadLimitFor ({ largerUploads = false } = {}) {
  return largerUploads ? PRO_UPLOAD_LIMIT_BYTES : FREE_UPLOAD_LIMIT_BYTES
}

/**
 * A limit as a round number of MB or GB, for the UI to translate the unit:
 * `{ size: 50, unit: 'MB' }`, `{ size: 1, unit: 'GB' }`
 */
export function uploadLimitParts (bytes) {
  if (bytes >= GB && bytes % GB === 0) return { size: bytes / GB, unit: 'GB' }
  return { size: Math.round(bytes / MB), unit: 'MB' }
}

// English label for server messages and logs: '50 MB', '1 GB'
export function uploadLimitLabel (bytes) {
  const { size, unit } = uploadLimitParts(bytes)
  return `${size} ${unit}`
}
