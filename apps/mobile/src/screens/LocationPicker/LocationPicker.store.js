import { fetchMapboxLocations, convertMapboxToLocation } from 'services/mapbox'
import { get } from 'lodash/fp'
import { LocationHelpers } from 'hylo-shared'
import { SET_SEARCH_SUGGESTIONS } from 'screens/ItemChooser/ItemChooser.store'

export const FIND_OR_CREATE_LOCATION = 'FIND_OR_CREATE_LOCATION'

export async function locationSearch (scope, searchTerm, proximity) {
  const coordinate = LocationHelpers.parseCoordinate(searchTerm).coordinate
  const mapboxLocations = coordinate
    // If coordinate then get results centered from that coordinate
    ? await fetchMapboxLocations(`${coordinate.lng},${coordinate.lat}`)
    : await fetchMapboxLocations(searchTerm, { proximity })
  const locations = mapboxLocations.features.map(feature => ({
    ...convertMapboxToLocation(feature),
    // TODO: Check this. Is this a mapbox ID or a hylo location ID?
    id: feature.id
  }))

  coordinate
    ? locations.unshift({ center: { lat: coordinate.lat, lng: coordinate.lng }, fullText: coordinate.string })
    : locations.unshift({ id: 'NEW', fullText: searchTerm })

  return {
    type: SET_SEARCH_SUGGESTIONS,
    payload: {
      scope,
      searchSuggestions: locations
    }
  }
}

export const FindOrCreateLocationMutation = `mutation (
  $accuracy: String,
  $addressNumber: String,
  $addressStreet: String,
  $bbox: [PointInput],
  $center: PointInput,
  $city: String,
  $country: String,
  $fullText: String,
  $geometry: [PointInput],
  $locality: String,
  $neighborhood: String,
  $region: String,
  $postcode: String,
  $wikidata: String
) {
  findOrCreateLocation(data: {
    accuracy: $accuracy,
    addressNumber: $addressNumber,
    addressStreet: $addressStreet,
    bbox: $bbox,
    center: $center
    city: $city
    country: $country,
    fullText: $fullText,
    geometry: $geometry,
    locality: $locality,
    neighborhood: $neighborhood,
    region: $region,
    postcode: $postcode,
    wikidata: $wikidata
  }) {
    id
    accuracy
    addressNumber
    addressStreet
    bbox {
      lat
      lng
    }
    center {
      lat
      lng
    }
    city
    country
    fullText
    locality
    neighborhood
    region
    postcode
  }
}`

export function findOrCreateLocation (data, query = FindOrCreateLocationMutation) {
  return {
    type: FIND_OR_CREATE_LOCATION,
    graphql: {
      query,
      variables: { ...data }
    },
    meta: {
      extractModel: {
        modelName: 'Location',
        getRoot: get('findOrCreateLocation')
      }
    }
  }
}

export function pollingFindOrCreateLocation (dispatch, locationData, callback) {
  const poll = (url, delay) => {
    if (delay > 4) return
    dispatch(findOrCreateLocation(locationData)).then(value => {
      if (!value) return
      const locationReceived = value.meta.extractModel.getRoot(value.payload.data)
      if (!locationReceived) {
        setTimeout(() => poll(url, delay * 2), delay * 1000)
      } else {
        callback(locationReceived)
      }
    })
  }
  poll(locationData, 0.5)
}
