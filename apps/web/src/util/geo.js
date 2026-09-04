import WebMercatorViewport from '@math.gl/web-mercator'

/**
 * Lat/lng from a Location model or a raw GraphQL locationObject.
 */
export function locationCenter (locationObject) {
  const center = locationObject?.center || locationObject?.ref?.center
  if (!center) return null
  const lat = parseFloat(center.lat)
  const lng = parseFloat(center.lng)
  if (Number.isNaN(lat) || Number.isNaN(lng)) return null
  return { lat, lng }
}

export function locationObjectToViewport (priorViewport, locationObject) {
  const bbox = locationObject.bbox
  if (bbox) {
    const bounds = [[parseFloat(bbox[0].lng), parseFloat(bbox[0].lat)], [parseFloat(bbox[1].lng), parseFloat(bbox[1].lat)]]
    return new WebMercatorViewport(priorViewport).fitBounds(bounds)
  } else {
    return { ...priorViewport, longitude: parseFloat(locationObject.center.lng), latitude: parseFloat(locationObject.center.lat), zoom: 12 }
  }
}
