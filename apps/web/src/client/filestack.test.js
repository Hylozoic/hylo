import { FREE_UPLOAD_LIMIT_BYTES, PRO_PLUS_UPLOAD_LIMIT_BYTES, PRO_UPLOAD_LIMIT_BYTES } from '@hylo/shared'
import { formatUploadLimit, MAX_UPLOAD_FILE_SIZE } from './filestack'

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
