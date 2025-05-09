export const getTrackIdFromPath = (path) => {
  if (!path) return null
  const match = path.match(/tracks\/(\d+)/)
  return match ? match[1] : null
}
