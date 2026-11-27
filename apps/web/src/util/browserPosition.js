/**
 * Asks the browser for the user's current position and calls onPosition with { lat, lng }.
 * Some browsers, privacy setups and webviews have no navigator.geolocation; then this does
 * nothing and returns false, so callers keep their fallback location.
 */
export function getBrowserPosition (onPosition) {
  const geolocation = typeof navigator !== 'undefined' ? navigator.geolocation : undefined
  if (!geolocation?.getCurrentPosition) return false
  geolocation.getCurrentPosition(position =>
    onPosition({ lat: position.coords.latitude, lng: position.coords.longitude }))
  return true
}
