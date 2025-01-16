import React from 'react'
import { Text, TouchableOpacity } from 'react-native'
import Icon from 'components/Icon'
import { rhino80, rhino20, caribbeanGreen } from 'style/colors'
import { useDispatch } from 'react-redux'
import { gql } from 'urql'

export const FIND_OR_CREATE_LOCATION = 'FIND_OR_CREATE_LOCATION'

export const findOrCreateLocationMutation = gql`
  mutation FindOrCreateLocationMutation (
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
  }
`

export function findOrCreateLocation (data, query = findOrCreateLocationMutation) {
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

export default function LocationSelectorModalItemRow ({ item, onPress }) {
  const isGeocoded = item.id !== 'NEW'
  const dispatch = useDispatch()

  const selectLocation = locationData => {
    if (!isGeocoded) {
      onPress(locationData)
    } else {
      pollingFindOrCreateLocation(
        dispatch,
        locationData,
        locationObject => onPress(locationObject)
      )
    }
  }

  return (
    <TouchableOpacity style={styles.locationRow} onPress={() => selectLocation(item)}>
      {!isGeocoded && (
        <>
          <Icon name='Back' color={rhino80} style={styles.locationIcon} />
          <Text style={[styles.locationText, styles.notGeocodedRow]}>Use "{item.fullText}" (without mapping)</Text>
        </>
      )}
      {isGeocoded && (
        <>
          <Icon name='Location' color={caribbeanGreen} style={styles.locationIcon} />
          <Text style={styles.locationText}>{item.fullText}</Text>
        </>
      )}
    </TouchableOpacity>
  )
}

const styles = {
  locationRow: {
    paddingHorizontal: 13,
    paddingTop: 13,
    marginTop: 13,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    borderTopWidth: 1,
    borderTopColor: rhino20
  },
  notGeocodedRow: {
    color: rhino80
  },
  locationIcon: {
    marginRight: 10
  },
  locationText: {
    color: caribbeanGreen,
    fontWeight: 'normal',
    fontFamily: 'Circular-Bold',
    flex: 1
  }
}
