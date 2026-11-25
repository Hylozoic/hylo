import { FREE_UPLOAD_LIMIT_BYTES, PRO_PLUS_UPLOAD_LIMIT_BYTES, PRO_UPLOAD_LIMIT_BYTES } from '@hylo/shared'
import {
  FILESTACK_ACCEPTED_MIME_TYPES_BY_ATTACHMENT_TYPE,
  formatUploadLimit,
  isPickerFileAccepted,
  MAX_UPLOAD_FILE_SIZE,
  pickerAcceptFromAttachmentType
} from './filestack'

const fileAccept = FILESTACK_ACCEPTED_MIME_TYPES_BY_ATTACHMENT_TYPE.file

describe('pickerAcceptFromAttachmentType', () => {
  it('keeps the desktop file dialog on the wildcard types', () => {
    expect(pickerAcceptFromAttachmentType('file', { mobile: false })).toEqual(fileAccept)
  })

  it('adds the types a phone file dialog actually honors, ahead of video', () => {
    expect(pickerAcceptFromAttachmentType('file', { mobile: true })).toEqual([
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
      'application/vnd.apple.pages',
      ...fileAccept
    ])
  })

  it('leaves image and csv dialogs alone on a phone', () => {
    expect(pickerAcceptFromAttachmentType('image', { mobile: true })).toEqual(['image/*'])
    expect(pickerAcceptFromAttachmentType('csv', { mobile: true })).toEqual(['text/csv'])
  })
})

describe('isPickerFileAccepted', () => {
  it('accepts documents, text, and video', () => {
    expect(isPickerFileAccepted({ mimetype: 'application/pdf', filename: 'notes.pdf' }, fileAccept)).toBe(true)
    expect(isPickerFileAccepted({ mimetype: 'text/markdown', filename: 'notes.md' }, fileAccept)).toBe(true)
    expect(isPickerFileAccepted({ mimetype: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', filename: 'notes.docx' }, fileAccept)).toBe(true)
    expect(isPickerFileAccepted({ mimetype: 'text/rtf', filename: 'notes.rtf' }, fileAccept)).toBe(true)
    expect(isPickerFileAccepted({ mimetype: 'text/csv', filename: 'members.csv' }, fileAccept)).toBe(true)
    expect(isPickerFileAccepted({ mimetype: 'video/mp4', filename: 'clip.mp4' }, fileAccept)).toBe(true)
  })

  it('accepts a markdown file when the phone leaves the MIME type blank', () => {
    expect(isPickerFileAccepted({ mimetype: '', filename: 'notes.md' }, fileAccept)).toBe(true)
    expect(isPickerFileAccepted({ filename: 'folder/readme.markdown' }, fileAccept)).toBe(true)
  })

  it('rejects images and types outside the file list', () => {
    expect(isPickerFileAccepted({ mimetype: 'image/png', filename: 'photo.png' }, fileAccept)).toBe(false)
    expect(isPickerFileAccepted({ mimetype: '', filename: 'photo.png' }, fileAccept)).toBe(false)
    expect(isPickerFileAccepted({ mimetype: 'font/woff2', filename: 'font.woff2' }, fileAccept)).toBe(false)
    expect(isPickerFileAccepted({ mimetype: '', filename: 'no-extension' }, fileAccept)).toBe(false)
  })
})

describe('filestack client', () => {
  it('keeps the default picker limit at the free upload limit', () => {
    expect(MAX_UPLOAD_FILE_SIZE).toBe(FREE_UPLOAD_LIMIT_BYTES)
  })

  it('formats a limit through the translation function, so the unit can be localised', () => {
    const t = jest.fn((key, params) => `${key}:${params.size}`)
    expect(formatUploadLimit(FREE_UPLOAD_LIMIT_BYTES, t)).toBe('{{size}} MB:50')
    expect(formatUploadLimit(PRO_UPLOAD_LIMIT_BYTES, t)).toBe('{{size}} MB:250')
    expect(formatUploadLimit(PRO_PLUS_UPLOAD_LIMIT_BYTES, t)).toBe('{{size}} GB:1')
  })
})
