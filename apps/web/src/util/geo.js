import centroid from '@turf/centroid'
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

/**
 * Center of a group boundary. Used when a group has a geoShape but no location pin.
 * Accepts a GeoJSON geometry, a Feature, or a JSON string of either.
 */
export function shapeCenter (geoShape) {
  if (!geoShape) return null
  let geometry = geoShape
  if (typeof geoShape === 'string') {
    try {
      geometry = JSON.parse(geoShape)
    } catch (e) {
      return null
    }
  }
  const coordinates = geometry?.coordinates || geometry?.geometry?.coordinates
  if (!coordinates) return null
  try {
    const feature = geometry.type ? geometry : { type: 'Polygon', coordinates }
    const [lng, lat] = centroid(feature).geometry.coordinates
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null
    return { lat, lng }
  } catch (e) {
    return null
  }
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
