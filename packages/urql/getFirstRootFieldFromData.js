export default function getFirstRootField(data) {
  if (!data || typeof data !== 'object') {
    return null
  }
  const keys = Object.keys(data)
  if (keys.length !== 1) {
    throw new Error('Data object must contain exactly one key')
  }
  return data[keys[0]]
}
