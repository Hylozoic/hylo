import {
  FILESTACK_ACCEPTED_MIME_TYPES,
  MAX_UPLOAD_FILE_SIZE,
  isAcceptedMimeType
} from 'client/filestack'

// Same number of files the upload buttons allow per pick
export const MAX_FILES_PER_DROP = 10

/**
 * True when a drag or clipboard event carries files (not just text, links or HTML).
 * During dragenter/dragover only `types` is readable, so this is what decides
 * whether to show the drop zone.
 */
export function dataTransferHasFiles (dataTransfer) {
  if (!dataTransfer?.types) return false
  return Array.from(dataTransfer.types).includes('Files')
}

/**
 * True when every file being dragged is an image. Only item kinds and types are
 * readable while dragging, so this uses `items` and falls back to false.
 */
export function draggedFilesAreImages (dataTransfer) {
  const items = Array.from(dataTransfer?.items || []).filter(item => item.kind === 'file')
  return items.length > 0 && items.every(item => (item.type || '').startsWith('image/'))
}

/**
 * The File objects in a drop or paste event's DataTransfer.
 */
export function filesFromDataTransfer (dataTransfer) {
  if (!dataTransfer) return []
  const files = Array.from(dataTransfer.files || [])
  if (files.length > 0) return files
  return Array.from(dataTransfer.items || [])
    .filter(item => item.kind === 'file')
    .map(item => item.getAsFile())
    .filter(Boolean)
}

/**
 * Files to upload from a paste, or an empty list when the paste should be left
 * to the editor as text. Spreadsheets and word processors put a picture of the
 * copied cells on the clipboard next to the text, so a paste that has plain
 * text is treated as a text paste.
 */
export function filesFromClipboard (clipboardData) {
  if (!dataTransferHasFiles(clipboardData)) return []
  const text = clipboardData.getData ? clipboardData.getData('text/plain') : ''
  if (text && text.trim()) return []
  return filesFromDataTransfer(clipboardData)
}

/**
 * Splits files into those we can upload and those we can't, using the same
 * accepted types and size limit as the Filestack picker.
 * Rejected entries say why: 'type', 'size' or 'count'.
 */
export function partitionFiles (files, {
  accept = FILESTACK_ACCEPTED_MIME_TYPES,
  maxSize = MAX_UPLOAD_FILE_SIZE,
  maxFiles = MAX_FILES_PER_DROP
} = {}) {
  const accepted = []
  const rejected = []

  for (const file of files) {
    if (!isAcceptedMimeType(file.type, accept)) {
      rejected.push({ file, reason: 'type' })
    } else if (file.size > maxSize) {
      rejected.push({ file, reason: 'size' })
    } else if (accepted.length >= maxFiles) {
      rejected.push({ file, reason: 'count' })
    } else {
      accepted.push(file)
    }
  }

  return { accepted, rejected }
}
