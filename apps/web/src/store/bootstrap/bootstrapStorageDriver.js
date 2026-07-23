export function getBootstrapRevision (bootstrapSlice) {
  if (!bootstrapSlice) return 0

  const times = []
  if (bootstrapSlice.checkLogin?.at) times.push(bootstrapSlice.checkLogin.at)
  if (bootstrapSlice.currentUser?.at) times.push(bootstrapSlice.currentUser.at)

  Object.values(bootstrapSlice.groupsBySlug || {}).forEach(entry => {
    if (entry?.at) times.push(entry.at)
  })

  ;(bootstrapSlice.groupsMenuDataBatches || []).forEach(batch => {
    if (batch?.at) times.push(batch.at)
  })

  return times.length ? Math.max(...times) : 0
}

function parseBootstrapSlice (value) {
  if (!value) return null
  try {
    return typeof value === 'string' ? JSON.parse(value) : value
  } catch (e) {
    return null
  }
}

export function createBootstrapStorageDriver (storage) {
  return {
    getItem (key) {
      return storage.getItem(key)
    },
    setItem (key, value) {
      if (key !== 'bootstrap') {
        return storage.setItem(key, value)
      }

      const existing = storage.getItem(key)
      if (existing) {
        const existingSlice = parseBootstrapSlice(existing)
        const nextSlice = parseBootstrapSlice(value)
        if (
          existingSlice &&
          nextSlice &&
          getBootstrapRevision(existingSlice) > getBootstrapRevision(nextSlice)
        ) {
          return
        }
      }

      return storage.setItem(key, value)
    }
  }
}

const memoryStorage = {
  _data: {},
  getItem (key) {
    return this._data[key] ?? null
  },
  setItem (key, value) {
    this._data[key] = value
  }
}

export function getBootstrapStorageDriver () {
  if (typeof window === 'undefined' || !window.localStorage) {
    return createBootstrapStorageDriver(memoryStorage)
  }

  return createBootstrapStorageDriver(window.localStorage)
}
