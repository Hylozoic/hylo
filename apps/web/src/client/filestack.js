import { filestackKey, isTest } from 'config/index'
import * as Filestack from 'filestack-js'
import { isSandboxMode } from 'sandbox/isSandbox'

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

export function uploadedFileToAttachment ({ url, filename, mimetype }) {
  return {
    url,
    filename,
    attachmentType: mimetypeToAttachmentType(mimetype)
  }
}

export function transformFile (file) {
  // Blob / sandbox uploads have no Filestack handle — keep the local URL.
  if (!file?.handle || String(file.url || '').startsWith('blob:')) {
    return file
  }
  // Apply rotation from EXIF metadata
  const url = getRootMimeType(file.mimetype) === 'image'
    ? 'https://cdn.filestackcontent.com/rotate=deg:exif/' + file.handle
    : file.url

  return { ...file, url }
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
      const accept = acceptFromAttachmentType(attachmentType)
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

  return filestack.picker({
    accept: acceptFromAttachmentType(attachmentType),
    customText: {
      'Select Files to Upload': attachmentType === 'image' ? t('Select Images to Upload (max 50 MB each)') : t('Select Files to Upload (max 50 MB each)')
    },
    fromSources: FILESTACK_FROM_SOURCES[attachmentType],
    maxFiles,
    maxSize: 52428800,
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
