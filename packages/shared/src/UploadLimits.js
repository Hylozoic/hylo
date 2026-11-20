/**
 * Attachment upload size limits (#1761). The one place these numbers live: the backend enforces
 * them (lib/uploader), the web shows them in the file picker and drop-zone copy and checks files
 * before uploading.
 */

export const MB = 1024 * 1024
export const GB = 1024 * MB

// Every upload: the limit the Filestack picker has always enforced on the web
export const FREE_UPLOAD_LIMIT_BYTES = 50 * MB
// Uploads to groups with the Hylo Pro `largerUploads` feature (Pro tier)
export const PRO_UPLOAD_LIMIT_BYTES = 250 * MB
// Uploads to groups with the Hylo Pro `higherUploadLimits` feature (Pro Plus tier)
export const PRO_PLUS_UPLOAD_LIMIT_BYTES = 1 * GB
// The largest limit any group can have, e.g. a ceiling for the server's multipart parser
export const MAX_UPLOAD_LIMIT_BYTES = PRO_PLUS_UPLOAD_LIMIT_BYTES

// The Hylo Pro features (HyloProFeatures.js) that raise a group's upload limit
export const UPLOAD_LIMIT_FEATURES = ['largerUploads', 'higherUploadLimits']

/**
 * One group's per-file limit, from its Hylo Pro features: the highest limit it is entitled to.
 * Each feature is checked on its own, so a group with `higherUploadLimits` granted outside its
 * tier gets 1 GB even without `largerUploads`.
 *
 * @param {{ largerUploads?: boolean, higherUploadLimits?: boolean }} features
 * @returns {number} bytes
 */
export function uploadLimitFor ({ largerUploads = false, higherUploadLimits = false } = {}) {
  if (higherUploadLimits) return PRO_PLUS_UPLOAD_LIMIT_BYTES
  if (largerUploads) return PRO_UPLOAD_LIMIT_BYTES
  return FREE_UPLOAD_LIMIT_BYTES
}

/**
 * The per-file limit for an upload to several groups: the lowest of their limits, so a file is
 * only as large as every group it goes to allows. The free limit when there are no groups.
 *
 * @param {Array<object>} groupsFeatures each group's Pro features, as for uploadLimitFor
 * @returns {number} bytes
 */
export function uploadLimitForGroups (groupsFeatures = []) {
  if (groupsFeatures.length === 0) return FREE_UPLOAD_LIMIT_BYTES
  return Math.min(...groupsFeatures.map(features => uploadLimitFor(features || {})))
}

/**
 * A limit as a round number of MB or GB, for the UI to translate the unit:
 * `{ size: 250, unit: 'MB' }`, `{ size: 1, unit: 'GB' }`
 */
export function uploadLimitParts (bytes) {
  if (bytes >= GB && bytes % GB === 0) return { size: bytes / GB, unit: 'GB' }
  return { size: Math.round(bytes / MB), unit: 'MB' }
}

// English label for server messages and logs: '50 MB', '250 MB', '1 GB'
export function uploadLimitLabel (bytes) {
  const { size, unit } = uploadLimitParts(bytes)
  return `${size} ${unit}`
}
