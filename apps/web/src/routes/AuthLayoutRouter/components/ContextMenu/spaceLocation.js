/** Location for space settings, from the Group already loaded into redux. */
export function spaceLocation (group) {
  const text = group?.ref?.location
  if (!text) return null

  const related = group.locationObject?.ref
  if (related?.fullText === text) return related

  const id = related?.id || (typeof group.ref.locationObject === 'string' ? group.ref.locationObject : null)
  return { id, fullText: text }
}

/** True once a query has written this attribute onto the group, including an explicit null. */
export function groupFieldLoaded (group, key) {
  const ref = group?.ref
  return Boolean(ref && Object.prototype.hasOwnProperty.call(ref, key))
}

/** GeoJSON geometry as the string createSpace/updateSpace expect, or null when there is no boundary. */
export function geoShapeForApi (geoShape) {
  if (!geoShape) return null
  if (typeof geoShape === 'string') return geoShape
  return JSON.stringify(geoShape)
}
