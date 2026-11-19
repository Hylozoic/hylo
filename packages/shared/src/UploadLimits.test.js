import {
  FREE_UPLOAD_LIMIT_BYTES,
  PRO_UPLOAD_LIMIT_BYTES,
  uploadLimitFor,
  uploadLimitLabel,
  uploadLimitParts
} from './UploadLimits'

describe('UploadLimits', () => {
  it('keeps the free limit at 50 MB and the Pro limit at 1 GB', () => {
    expect(FREE_UPLOAD_LIMIT_BYTES).toBe(52428800)
    expect(PRO_UPLOAD_LIMIT_BYTES).toBe(1073741824)
  })

  it('gives the Pro limit only with the largerUploads feature', () => {
    expect(uploadLimitFor({ largerUploads: true })).toBe(PRO_UPLOAD_LIMIT_BYTES)
    expect(uploadLimitFor({ largerUploads: false })).toBe(FREE_UPLOAD_LIMIT_BYTES)
    expect(uploadLimitFor({})).toBe(FREE_UPLOAD_LIMIT_BYTES)
    expect(uploadLimitFor()).toBe(FREE_UPLOAD_LIMIT_BYTES)
  })

  it('describes a limit in whole MB or GB', () => {
    expect(uploadLimitParts(FREE_UPLOAD_LIMIT_BYTES)).toEqual({ size: 50, unit: 'MB' })
    expect(uploadLimitParts(PRO_UPLOAD_LIMIT_BYTES)).toEqual({ size: 1, unit: 'GB' })
    expect(uploadLimitParts(1536 * 1024 * 1024)).toEqual({ size: 1536, unit: 'MB' })
    expect(uploadLimitLabel(FREE_UPLOAD_LIMIT_BYTES)).toBe('50 MB')
    expect(uploadLimitLabel(PRO_UPLOAD_LIMIT_BYTES)).toBe('1 GB')
  })
})
