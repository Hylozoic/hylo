/** Location for space settings, from the Group already loaded into redux. */
export function spaceLocation (group) {
  const text = group?.ref?.location
  if (!text) return null

  const related = group.locationObject?.ref
  if (related?.fullText === text) return related

  const id = related?.id || (typeof group.ref.locationObject === 'string' ? group.ref.locationObject : null)
  return { id, fullText: text }
}
