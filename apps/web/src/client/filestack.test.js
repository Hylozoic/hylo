import {
  FILESTACK_ACCEPTED_MIME_TYPES_BY_ATTACHMENT_TYPE,
  isPickerFileAccepted,
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
