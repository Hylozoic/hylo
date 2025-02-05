import Config from 'react-native-config'

const MAPBOX_GEOCODING_API_URL = 'https://api.tiles.mapbox.com/geocoding/v5/mapbox.places'
const DEFAULT_PROXIMITY = '0,0' // Default to coordinates (longitude, latitude)

export async function fetchMapboxLocations (searchTerm, {
  proximity = DEFAULT_PROXIMITY,
  bbox = '',
  types = ''
} = {}) {
  let uri

  if (searchTerm) {
    // Forward Geocoding
    uri = MAPBOX_GEOCODING_API_URL +
      '/' +
      encodeURIComponent(searchTerm) +
      '.json?access_token=' +
      Config.MAPBOX_TOKEN +
      (proximity ? '&proximity=' + proximity : '') +
      (bbox ? '&bbox=' + bbox : '') +
      (types ? '&types=' + encodeURIComponent(types) : '')
  } else {
    // Reverse Geocoding
    if (proximity === DEFAULT_PROXIMITY) {
      console.warn(`No proximity provided. Defaulting to ${DEFAULT_PROXIMITY} (longitude, latitude).`)
    }

    const [lng, lat] = proximity.split(',')
    uri = MAPBOX_GEOCODING_API_URL +
      '/' +
      encodeURIComponent(`${lng},${lat}`) +
      '.json?access_token=' +
      Config.MAPBOX_TOKEN +
      (types ? '&types=' + encodeURIComponent(types) : '')
  }

  const response = await fetch(uri, {
    method: 'GET',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json'
    }
  })

  return response.json()
}

export function convertMapboxToLocation (mapboxResult) {
  const context = mapboxResult.context
  const neighborhoodObject = context && context.find(c => c.id.includes('neighborhood'))
  const postcodeObject = context && context.find(c => c.id.includes('postcode'))
  const placeObject = context && context.find(c => c.id.includes('place'))
  const regionObject = context && context.find(c => c.id.includes('region'))
  const countryObject = context && context.find(c => c.id.includes('country'))

  const city = placeObject ? placeObject.text : mapboxResult.place_type[0] === 'place' ? mapboxResult.text : ''

  let addressNumber = ''
  let addressStreet = ''
  if (mapboxResult.properties.address) {
    // For Points of Interest and landmarks Mapbox annoyingly stores the address in a single string inside properties
    addressNumber = mapboxResult.properties.address.split(' ')[0]
    addressStreet = mapboxResult.properties.address.split(' ')[1]
  } else if (mapboxResult.place_type[0] === 'address') {
    addressStreet = mapboxResult.text
    addressNumber = mapboxResult.address
  }

  return {
    accuracy: mapboxResult.properties.accuracy,
    addressNumber,
    addressStreet,
    bbox: mapboxResult.bbox ? [{ lng: mapboxResult.bbox[0], lat: mapboxResult.bbox[1] }, { lng: mapboxResult.bbox[2], lat: mapboxResult.bbox[3] }] : null,
    center: { lng: mapboxResult.center[0], lat: mapboxResult.center[1] },
    city,
    country: countryObject && countryObject.short_code,
    fullText: mapboxResult.place_name,
    // geometry: [Point]
    // locality
    mapboxId: mapboxResult.id,
    neighborhood: neighborhoodObject && neighborhoodObject.text,
    region: regionObject && regionObject.text,
    postcode: postcodeObject && postcodeObject.text
    // wikidata: String
  }
}
