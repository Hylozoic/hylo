import React, { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { isEmpty } from 'lodash/fp'
import { LocationHelpers } from '@hylo/shared'
import { fetchMapboxLocations, convertMapboxToLocation } from 'services/mapbox'
import useCurrentLocation from 'hooks/useCurrentLocation'
import ItemSelectorModal from 'components/ItemSelectorModal'
import LocationSelectorModalItemRow from './LocationSelectorModalItemRow'

export async function locationSearch (searchTerm, proximity) {
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

  if (coordinate) {
    locations.unshift({ center: { lat: coordinate.lat, lng: coordinate.lng }, fullText: coordinate.string })
  } else if (!isEmpty(searchTerm)) {
    locations.unshift({ id: 'NEW', fullText: searchTerm })
  }

  return locations
}

export const LocationSelectorModal = React.forwardRef((forwardedProps, ref) => {
  const { t } = useTranslation()
  const [, getLocation] = useCurrentLocation()
  const [locations, setLocations] = useState([])

  const fetchItems = async ({ searchTerm }) => {
    const currentLocation = await getLocation()
    const proximity = currentLocation?.coords
      ? `${currentLocation.coords.longitude},${currentLocation.coords.latitude}`
      : '0,0'
    const results = await locationSearch(searchTerm, proximity)
    setLocations(results)
  }

  return (
    <ItemSelectorModal
      title='Search for your location'
      fetchItems={fetchItems}
      items={locations}
      searchPlaceholder={t('Search for your location')}
      {...forwardedProps}
      ref={ref}
      renderItem={LocationSelectorModalItemRow}
    />
  )
})

export default LocationSelectorModal
