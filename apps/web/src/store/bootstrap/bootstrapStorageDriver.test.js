import {
  createBootstrapStorageDriver,
  getBootstrapRevision
} from 'store/bootstrap/bootstrapStorageDriver'

describe('bootstrapStorageDriver', () => {
  it('computes revision from bootstrap timestamps', () => {
    expect(getBootstrapRevision({
      currentUser: { at: 100 },
      groupsBySlug: { hylo: { at: 200 } }
    })).toBe(200)
  })

  it('skips stale writes for bootstrap key', () => {
    const storage = {
      _data: {},
      getItem (key) { return this._data[key] ?? null },
      setItem (key, value) { this._data[key] = value }
    }
    const driver = createBootstrapStorageDriver(storage)

    driver.setItem('bootstrap', JSON.stringify({
      _version: 1,
      currentUser: { at: 200, data: { me: { id: 'fresh' } } }
    }))
    driver.setItem('bootstrap', JSON.stringify({
      _version: 1,
      currentUser: { at: 100, data: { me: { id: 'stale' } } }
    }))

    expect(JSON.parse(storage.getItem('bootstrap')).currentUser.data.me.id).toBe('fresh')
  })
})
