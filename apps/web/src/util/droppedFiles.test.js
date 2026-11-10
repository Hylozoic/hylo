import { isAcceptedMimeType } from 'client/filestack'
import {
  dataTransferHasFiles,
  draggedFilesAreImages,
  filesFromClipboard,
  filesFromDataTransfer,
  partitionFiles
} from './droppedFiles'

const file = (name, type, size = 100) => {
  const f = new window.File(['x'], name, { type })
  Object.defineProperty(f, 'size', { value: size })
  return f
}

const fileItem = f => ({ kind: 'file', type: f.type, getAsFile: () => f })

describe('isAcceptedMimeType', () => {
  it('accepts the types the Filestack picker accepts', () => {
    expect(isAcceptedMimeType('image/png')).toBe(true)
    expect(isAcceptedMimeType('application/pdf')).toBe(true)
    expect(isAcceptedMimeType('text/csv')).toBe(true)
    expect(isAcceptedMimeType('video/mp4')).toBe(true)
    expect(isAcceptedMimeType('audio/mpeg')).toBe(true)
  })

  it('rejects unknown or unaccepted types', () => {
    expect(isAcceptedMimeType('')).toBe(false)
    expect(isAcceptedMimeType(undefined)).toBe(false)
    expect(isAcceptedMimeType('font/woff2')).toBe(false)
  })

  it('narrows to a given accept list', () => {
    expect(isAcceptedMimeType('image/jpeg', ['image/*'])).toBe(true)
    expect(isAcceptedMimeType('application/pdf', ['image/*'])).toBe(false)
    expect(isAcceptedMimeType('text/csv', ['text/csv'])).toBe(true)
    expect(isAcceptedMimeType('text/plain', ['text/csv'])).toBe(false)
  })
})

describe('dataTransferHasFiles', () => {
  it('is true only when files are being dragged or pasted', () => {
    expect(dataTransferHasFiles({ types: ['Files'] })).toBe(true)
    expect(dataTransferHasFiles({ types: ['text/plain', 'text/uri-list'] })).toBe(false)
    expect(dataTransferHasFiles(null)).toBe(false)
  })
})

describe('draggedFilesAreImages', () => {
  it('is true when every dragged file is an image', () => {
    expect(draggedFilesAreImages({ items: [{ kind: 'file', type: 'image/png' }, { kind: 'file', type: 'image/gif' }] })).toBe(true)
    expect(draggedFilesAreImages({ items: [{ kind: 'file', type: 'image/png' }, { kind: 'file', type: 'application/pdf' }] })).toBe(false)
    expect(draggedFilesAreImages({ items: [] })).toBe(false)
  })
})

describe('filesFromDataTransfer', () => {
  it('reads files, falling back to file items', () => {
    const a = file('a.png', 'image/png')
    expect(filesFromDataTransfer({ files: [a] })).toEqual([a])
    expect(filesFromDataTransfer({ files: [], items: [fileItem(a), { kind: 'string', type: 'text/plain' }] })).toEqual([a])
    expect(filesFromDataTransfer(null)).toEqual([])
  })
})

describe('filesFromClipboard', () => {
  const image = file('image.png', 'image/png')

  it('returns pasted image files', () => {
    const clipboard = { types: ['Files'], files: [image], getData: () => '' }
    expect(filesFromClipboard(clipboard)).toEqual([image])
  })

  it('leaves a paste that has plain text (e.g. spreadsheet cells) to the editor', () => {
    const clipboard = { types: ['text/plain', 'text/html', 'Files'], files: [image], getData: type => type === 'text/plain' ? 'A1\tB1' : '' }
    expect(filesFromClipboard(clipboard)).toEqual([])
  })

  it('returns nothing for a text-only paste', () => {
    expect(filesFromClipboard({ types: ['text/plain'], files: [], getData: () => 'hi' })).toEqual([])
  })
})

describe('partitionFiles', () => {
  it('rejects unaccepted types and files over the size limit', () => {
    const ok = file('a.png', 'image/png')
    const badType = file('a.woff2', 'font/woff2')
    const tooBig = file('big.pdf', 'application/pdf', 60 * 1024 * 1024)
    const { accepted, rejected } = partitionFiles([ok, badType, tooBig])
    expect(accepted).toEqual([ok])
    expect(rejected).toEqual([{ file: badType, reason: 'type' }, { file: tooBig, reason: 'size' }])
  })

  it('caps how many files are accepted', () => {
    const files = [1, 2, 3].map(n => file(`${n}.png`, 'image/png'))
    const { accepted, rejected } = partitionFiles(files, { maxFiles: 2 })
    expect(accepted).toEqual(files.slice(0, 2))
    expect(rejected).toEqual([{ file: files[2], reason: 'count' }])
  })
})
