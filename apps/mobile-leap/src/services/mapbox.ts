import { MAPBOX_TOKEN } from 'config'

const MAPBOX_GEOCODING_API_URL = 'https://api.tiles.mapbox.com/geocoding/v5/mapbox.places'
const DEFAULT_PROXIMITY = '0,0'

export async function fetchMapboxLocations (
  searchTerm: string,
  {
    proximity = DEFAULT_PROXIMITY,
    bbox = '',
    types = ''
  }: { proximity?: string, bbox?: string, types?: string } = {}
) {
  if (!MAPBOX_TOKEN) {
    console.warn('MAPBOX_TOKEN is not configured')
    return { features: [] }
  }

  let uri
  if (searchTerm) {
    uri = `${MAPBOX_GEOCODING_API_URL}/${encodeURIComponent(searchTerm)}.json?access_token=${MAPBOX_TOKEN}` +
      `&autocomplete=true` +
      (proximity ? `&proximity=${proximity}` : '') +
      (bbox ? `&bbox=${bbox}` : '') +
      (types ? `&types=${encodeURIComponent(types)}` : '')
  } else {
    const [lng, lat] = proximity.split(',')
    uri = `${MAPBOX_GEOCODING_API_URL}/${encodeURIComponent(`${lng},${lat}`)}.json?access_token=${MAPBOX_TOKEN}` +
      (types ? `&types=${encodeURIComponent(types)}` : '')
  }

  const response = await fetch(uri, {
    method: 'GET',
    headers: {
      Accept: 'application/json'
    }
  })

  const payload = await response.json()
  if (!response.ok) {
    throw new Error(payload?.message || `Mapbox geocoding failed (${response.status})`)
  }

  return payload
}

export function convertMapboxToLocation (mapboxResult: {
  context?: Array<{ id: string, text: string, short_code?: string }>
  place_type: string[]
  text: string
  place_name: string
  properties?: { address?: string, accuracy?: string }
  address?: string
  bbox?: number[]
  center: number[]
  id: string
}) {
  const context = mapboxResult.context
  const neighborhoodObject = context?.find(c => c.id.includes('neighborhood'))
  const postcodeObject = context?.find(c => c.id.includes('postcode'))
  const placeObject = context?.find(c => c.id.includes('place'))
  const regionObject = context?.find(c => c.id.includes('region'))
  const countryObject = context?.find(c => c.id.includes('country'))

  const placeType = mapboxResult.place_type?.[0]
  const city = placeObject
    ? placeObject.text
    : placeType === 'place'
      ? mapboxResult.text
      : ''

  let addressNumber = ''
  let addressStreet = ''
  if (mapboxResult.properties?.address) {
    addressNumber = mapboxResult.properties.address.split(' ')[0]
    addressStreet = mapboxResult.properties.address.split(' ')[1] ?? ''
  } else if (placeType === 'address') {
    addressStreet = mapboxResult.text
    addressNumber = mapboxResult.address ?? ''
  }

  return {
    accuracy: mapboxResult.properties?.accuracy,
    addressNumber,
    addressStreet,
    bbox: mapboxResult.bbox
      ? [{ lng: mapboxResult.bbox[0], lat: mapboxResult.bbox[1] }, { lng: mapboxResult.bbox[2], lat: mapboxResult.bbox[3] }]
      : null,
    center: { lng: mapboxResult.center[0], lat: mapboxResult.center[1] },
    city,
    country: countryObject?.short_code,
    fullText: mapboxResult.place_name,
    mapboxId: mapboxResult.id,
    neighborhood: neighborhoodObject?.text,
    region: regionObject?.text,
    postcode: postcodeObject?.text
  }
}
