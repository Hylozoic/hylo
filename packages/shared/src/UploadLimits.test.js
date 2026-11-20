import {
  FREE_UPLOAD_LIMIT_BYTES,
  MAX_UPLOAD_LIMIT_BYTES,
  PRO_PLUS_UPLOAD_LIMIT_BYTES,
  PRO_UPLOAD_LIMIT_BYTES,
  UPLOAD_LIMIT_FEATURES,
  uploadLimitFor,
  uploadLimitForGroups,
  uploadLimitLabel,
  uploadLimitParts
} from './UploadLimits'
import { isProFeature, tierOfProFeature } from './HyloProFeatures'

describe('UploadLimits', () => {
  it('keeps the free limit at 50 MB, Pro at 250 MB and Pro Plus at 1 GB', () => {
    expect(FREE_UPLOAD_LIMIT_BYTES).toBe(52428800)
    expect(PRO_UPLOAD_LIMIT_BYTES).toBe(262144000)
    expect(PRO_PLUS_UPLOAD_LIMIT_BYTES).toBe(1073741824)
    expect(MAX_UPLOAD_LIMIT_BYTES).toBe(PRO_PLUS_UPLOAD_LIMIT_BYTES)
  })

  it('names registered Pro features of the Pro and Pro Plus tiers', () => {
    expect(UPLOAD_LIMIT_FEATURES.every(isProFeature)).toBe(true)
    expect(tierOfProFeature('largerUploads')).toBe('pro')
    expect(tierOfProFeature('higherUploadLimits')).toBe('pro_plus')
  })

  it('gives a group the highest limit it is entitled to', () => {
    expect(uploadLimitFor({ largerUploads: true })).toBe(PRO_UPLOAD_LIMIT_BYTES)
    expect(uploadLimitFor({ largerUploads: true, higherUploadLimits: true })).toBe(PRO_PLUS_UPLOAD_LIMIT_BYTES)
    expect(uploadLimitFor({ higherUploadLimits: true })).toBe(PRO_PLUS_UPLOAD_LIMIT_BYTES)
    expect(uploadLimitFor({ largerUploads: false })).toBe(FREE_UPLOAD_LIMIT_BYTES)
    expect(uploadLimitFor({})).toBe(FREE_UPLOAD_LIMIT_BYTES)
    expect(uploadLimitFor()).toBe(FREE_UPLOAD_LIMIT_BYTES)
  })

  it('gives an upload to several groups the highest of their limits', () => {
    const plus = { largerUploads: true, higherUploadLimits: true }
    const pro = { largerUploads: true }
    expect(uploadLimitForGroups([])).toBe(FREE_UPLOAD_LIMIT_BYTES)
    expect(uploadLimitForGroups()).toBe(FREE_UPLOAD_LIMIT_BYTES)
    expect(uploadLimitForGroups([plus])).toBe(PRO_PLUS_UPLOAD_LIMIT_BYTES)
    expect(uploadLimitForGroups([plus, plus])).toBe(PRO_PLUS_UPLOAD_LIMIT_BYTES)
    expect(uploadLimitForGroups([plus, pro])).toBe(PRO_PLUS_UPLOAD_LIMIT_BYTES)
    expect(uploadLimitForGroups([{}, pro, plus])).toBe(PRO_PLUS_UPLOAD_LIMIT_BYTES)
    expect(uploadLimitForGroups([{}, pro])).toBe(PRO_UPLOAD_LIMIT_BYTES)
    expect(uploadLimitForGroups([plus, null])).toBe(PRO_PLUS_UPLOAD_LIMIT_BYTES)
    expect(uploadLimitForGroups([{}, null])).toBe(FREE_UPLOAD_LIMIT_BYTES)
  })

  it('describes a limit in whole MB or GB', () => {
    expect(uploadLimitParts(FREE_UPLOAD_LIMIT_BYTES)).toEqual({ size: 50, unit: 'MB' })
    expect(uploadLimitParts(PRO_UPLOAD_LIMIT_BYTES)).toEqual({ size: 250, unit: 'MB' })
    expect(uploadLimitParts(PRO_PLUS_UPLOAD_LIMIT_BYTES)).toEqual({ size: 1, unit: 'GB' })
    expect(uploadLimitParts(1536 * 1024 * 1024)).toEqual({ size: 1536, unit: 'MB' })
    expect(uploadLimitLabel(FREE_UPLOAD_LIMIT_BYTES)).toBe('50 MB')
    expect(uploadLimitLabel(PRO_UPLOAD_LIMIT_BYTES)).toBe('250 MB')
    expect(uploadLimitLabel(PRO_PLUS_UPLOAD_LIMIT_BYTES)).toBe('1 GB')
  })
})
