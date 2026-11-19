import { filestackKey, isTest } from 'config/index'
import * as Filestack from 'filestack-js'
import { isSandboxMode } from 'sandbox/isSandbox'
import { isMobileDevice } from 'util/mobile'

// Dev / CI often omit VITE_FILESTACK_API_KEY; Filestack.init(undefined) throws and breaks the whole tree (e.g. Playwright /login).
const filestack = Filestack.init(isTest || !filestackKey ? 'dummykey' : filestackKey)

const FILESTACK_FROM_SOURCES = {
  csv: [
    'local_file_system',
    'url',
    'googledrive',
    'dropbox'
  ],
  image: [
    'local_file_system',
    'url',
    'webcam',
    'instagram',
    'facebook',
    'imagesearch',
    'googledrive',
    'dropbox'
  ],
  file: [
    'local_file_system',
    'url',
    'googledrive',
    'dropbox'
  ]
}

export const FILESTACK_ACCEPTED_MIME_TYPES_BY_ATTACHMENT_TYPE = {
  csv: ['text/csv'],
  image: ['image/*'],
  file: ['video/*', 'audio/*', 'application/*', 'text/*']
}

export const FILESTACK_ACCEPTED_MIME_TYPES = [
  ...FILESTACK_ACCEPTED_MIME_TYPES_BY_ATTACHMENT_TYPE.csv,
  ...FILESTACK_ACCEPTED_MIME_TYPES_BY_ATTACHMENT_TYPE.image,
  ...FILESTACK_ACCEPTED_MIME_TYPES_BY_ATTACHMENT_TYPE.file
]

export const ACCEPTED_ATTACHMENT_TYPES = ['csv', 'image', 'file']

// Same per-file limit the Filestack picker enforces (50 MB)
export const MAX_UPLOAD_FILE_SIZE = 52428800

/**
 * True when `mimetype` matches one of the accepted patterns (exact, or `root/*`).
 */
export function isAcceptedMimeType (mimetype, accept = FILESTACK_ACCEPTED_MIME_TYPES) {
  if (!mimetype) return false
  const type = mimetype.toLowerCase()
  return accept.some(pattern => pattern.endsWith('/*')
    ? getRootMimeType(type) === getRootMimeType(pattern)
    : type === pattern)
}

export function getRootMimeType (mimetype = '') {
  return mimetype.split('/')[0]
}

export function mimetypeToAttachmentType (mimetype) {
  const rootMimetype = getRootMimeType(mimetype)

  return ACCEPTED_ATTACHMENT_TYPES.includes(rootMimetype)
    ? rootMimetype
    : 'file'
}

export function acceptFromAttachmentType (attachmentType) {
  return attachmentType && ACCEPTED_ATTACHMENT_TYPES.includes(attachmentType)
    ? FILESTACK_ACCEPTED_MIME_TYPES_BY_ATTACHMENT_TYPE[attachmentType]
    : FILESTACK_ACCEPTED_MIME_TYPES
}

// Phones ignore application/* and text/*, and a list that also contains video/*
// opens a video-only picker. octet-stream is public.data on iOS (every document;
// the photo library stays videos) and tells Android to offer every file.
// The concrete types cover pickers that only honor an exact MIME type.
const MOBILE_FILE_PICKER_MIME_TYPES = [
  'application/octet-stream',
  'application/pdf',
  'text/plain',
  'text/markdown',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/rtf',
  'text/rtf',
  'application/vnd.oasis.opendocument.text',
  'text/csv',
  'text/html',
  'application/vnd.apple.pages'
]

const IMAGE_FILE_EXTENSIONS = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'heic', 'heif', 'bmp', 'svg', 'avif', 'tif', 'tiff']

/**
 * Accept list for the system file dialog. Desktop keeps the wildcard list.
 * On a phone, general file picks also include types the mobile dialog actually honors.
 */
export function pickerAcceptFromAttachmentType (attachmentType, { mobile = isMobileDevice() } = {}) {
  const accept = acceptFromAttachmentType(attachmentType)
  if (attachmentType !== 'file' || !mobile) return accept
  const extra = MOBILE_FILE_PICKER_MIME_TYPES.filter(type => !accept.includes(type))
  return [...extra, ...accept]
}

/**
 * Extension of a filename, or '' when there is none.
 */
function fileExtension (name = '') {
  const base = String(name).split(/[/\\]/).pop() || ''
  const dot = base.lastIndexOf('.')
  if (dot <= 0) return ''
  return base.slice(dot + 1).toLowerCase()
}

/**
 * True when a picked file is allowed for this accept list.
 * Phones often leave the MIME type blank for markdown and other text files.
 * A blank type is allowed unless the name is an image, which has its own button.
 */
export function isPickerFileAccepted (file, accept) {
  const mimetype = (file?.mimetype || file?.type || '').toLowerCase()
  if (isAcceptedMimeType(mimetype, accept)) return true
  if (mimetype) return false
  const extension = fileExtension(file?.filename || file?.name || file?.originalFile?.name)
  return extension !== '' && !IMAGE_FILE_EXTENSIONS.includes(extension)
}

export function uploadedFileToAttachment ({ url, filename, mimetype }) {
  return {
    url,
    filename,
    attachmentType: mimetypeToAttachmentType(mimetype)
  }
}

/**
 * Merges the /noo/upload response onto the local attachment.
 * An uploaded mp4 is a file. The server used to label it `video`, which is a
 * legacy embed type the post UI does not render, so the file never appeared.
 */
export function attachmentFromUpload (attachment = {}, payload = {}) {
  const attachmentType = payload.attachmentType === 'video'
    ? (attachment.attachmentType || 'file')
    : (payload.attachmentType || attachment.attachmentType)
  return { ...attachment, ...payload, attachmentType }
}

export function transformFile (file) {
  if (!file) return file
  const filename = typeof file.filename === 'string'
    ? file.filename.replace(/\s+/g, '-')
    : file.filename
  // Blob / sandbox uploads have no Filestack handle — keep the local URL.
  // Always fetch by handle. Filestack sometimes appends the original filename
  // (spaces → 400) or a rotate=deg:exif transform (400 for SVG / some PNGs).
  if (!file.handle || String(file.url || '').startsWith('blob:')) {
    return { ...file, filename }
  }
  return {
    ...file,
    filename,
    url: `https://cdn.filestackcontent.com/${file.handle}`
  }
}

/**
 * Local file picker for sandbox — returns blob: URLs instead of talking to Filestack.
 */
function sandboxFilePicker ({
  attachmentType = 'image',
  maxFiles = 1,
  onFileUploadFinished = () => {},
  onUploadDone,
  onCancel
}) {
  return {
    open () {
      const input = document.createElement('input')
      input.type = 'file'
      input.multiple = maxFiles > 1
      const accept = pickerAcceptFromAttachmentType(attachmentType)
      if (Array.isArray(accept)) input.accept = accept.join(',')

      input.addEventListener('change', async () => {
        const files = Array.from(input.files || []).slice(0, maxFiles)
        if (!files.length) {
          onCancel?.()
          return
        }
        const filesUploaded = files.map(file => ({
          url: URL.createObjectURL(file),
          filename: file.name,
          mimetype: file.type || 'application/octet-stream',
          handle: null
        }))
        for (const file of filesUploaded) {
          onFileUploadFinished(transformFile(file))
        }
        await onUploadDone?.({
          filesUploaded: filesUploaded.map(file => transformFile(file))
        })
      })

      input.addEventListener('cancel', () => onCancel?.())
      input.click()
    }
  }
}

/**
 * Uploads a File (from drag and drop or the clipboard) without the picker UI.
 * Resolves to the same shape the picker passes to onFileUploadFinished.
 */
export async function uploadFile (file) {
  if (isSandboxMode()) {
    return transformFile({
      url: URL.createObjectURL(file),
      filename: file.name,
      mimetype: file.type || 'application/octet-stream',
      handle: null
    })
  }

  // Resolves to a filestack-js File: filename and mimetype are prototype getters, so pick fields explicitly
  const uploaded = await filestack.upload(file)
  return transformFile({
    url: uploaded.url,
    handle: uploaded.handle,
    filename: uploaded.filename || file.name,
    mimetype: uploaded.mimetype || file.type
  })
}

export function filestackPicker ({
  attachmentType = 'image',
  maxFiles = 1,
  onFileUploadFinished = () => {},
  onUploadDone,
  onCancel,
  t,
  ...rest
}) {
  if (isSandboxMode()) {
    return sandboxFilePicker({
      attachmentType,
      maxFiles,
      onFileUploadFinished,
      onUploadDone,
      onCancel
    })
  }

  const mobileFilePick = attachmentType === 'file' && isMobileDevice()
  const typeAccept = acceptFromAttachmentType(attachmentType)

  return filestack.picker({
    accept: pickerAcceptFromAttachmentType(attachmentType),
    // Filestack skips its own type check when this is set. Phones report no MIME
    // type for a lot of text files, which that check would reject.
    ...(mobileFilePick
      ? {
          acceptFn: file => isPickerFileAccepted(file, typeAccept)
            ? Promise.resolve()
            : Promise.reject(typeof t === 'function' ? t('This file type is not supported') : 'This file type is not supported')
        }
      : {}),
    customText: {
      'Select Files to Upload': attachmentType === 'image' ? t('Select Images to Upload (max 50 MB each)') : t('Select Files to Upload (max 50 MB each)')
    },
    fromSources: FILESTACK_FROM_SOURCES[attachmentType],
    maxFiles,
    maxSize: MAX_UPLOAD_FILE_SIZE,
    onFileUploadFinished: fileUploaded =>
      onFileUploadFinished(transformFile(fileUploaded)),
    onUploadDone: ({ filesUploaded, ...rest }) => {
      return onUploadDone({
        filesUploaded: filesUploaded.map(file => transformFile(file)),
        ...rest
      })
    },
    onCancel,
    ...rest
  })
}
