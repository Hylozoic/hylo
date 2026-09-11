import { useCallback, useEffect, useState } from 'react'
import { ActivityIndicator, Pressable, ScrollView, Text, TextInput, View } from 'react-native'
import { useTranslation } from 'react-i18next'
import { isEmpty } from 'lodash/fp'
import { LocationHelpers } from '@hylo/shared'
import useFindOrCreateLocationObject from '@hylo/hooks/useFindOrCreateLocationObject'
import { convertMapboxToLocation, fetchMapboxLocations } from '../services/mapbox'
import useCurrentLocation from '../hooks/useCurrentLocation'

export const PLAIN_TEXT_LOCATION_ID = 'NEW'

type LocationItem = {
  id?: string | null
  fullText: string
  center?: { lat: number, lng: number }
}

async function locationSearch (searchTerm: string, proximity: string) {
  const coordinate = LocationHelpers.parseCoordinate(searchTerm).coordinate
  let locations: LocationItem[] = []

  try {
    const mapboxLocations = coordinate
      ? await fetchMapboxLocations(`${coordinate.lng},${coordinate.lat}`)
      : await fetchMapboxLocations(searchTerm, { proximity })

    locations = (mapboxLocations.features ?? []).flatMap((feature: Parameters<typeof convertMapboxToLocation>[0]) => {
      try {
        return [{ ...convertMapboxToLocation(feature), id: feature.id }]
      } catch {
        return []
      }
    })
  } catch (error) {
    console.warn('Mapbox location search failed:', error)
  }

  if (coordinate) {
    locations.unshift({ center: { lat: coordinate.lat, lng: coordinate.lng }, fullText: coordinate.string })
  } else if (!isEmpty(searchTerm)) {
    locations.unshift({ id: PLAIN_TEXT_LOCATION_ID, fullText: searchTerm })
  }

  return locations
}

type LocationSelectorProps = {
  onSelect: (location: LocationItem) => void
}

function LocationRow ({
  item,
  onPress
}: {
  item: LocationItem
  onPress: (item: LocationItem) => void
}) {
  const [, findOrCreateLocationObject] = useFindOrCreateLocationObject()
  const isGeocoded = item.id !== PLAIN_TEXT_LOCATION_ID

  const handlePress = async () => {
    if (!isGeocoded) {
      onPress({ id: null, fullText: item.fullText })
      return
    }

    const { locationObject } = await findOrCreateLocationObject(item)
    if (locationObject) onPress(locationObject)
  }

  return (
    <Pressable className='border-t border-selected/20 px-3 py-3' onPress={handlePress}>
      <Text className='text-base text-selected'>
        {isGeocoded ? item.fullText : `Use "${item.fullText}" (without mapping)`}
      </Text>
    </Pressable>
  )
}

export default function LocationSelector ({ onSelect }: LocationSelectorProps) {
  const { t } = useTranslation()
  const [{ currentLocation }, getLocation] = useCurrentLocation()
  const [searchTerm, setSearchTerm] = useState('')
  const [debouncedTerm, setDebouncedTerm] = useState('')
  const [locations, setLocations] = useState<LocationItem[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    getLocation()
  }, [getLocation])

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedTerm(searchTerm.trim()), 300)
    return () => clearTimeout(timer)
  }, [searchTerm])

  const fetchLocations = useCallback(async (term: string) => {
    if (!term) {
      setLocations([])
      return
    }

    setLoading(true)
    try {
      const proximity = currentLocation?.coords
        ? `${currentLocation.coords.longitude},${currentLocation.coords.latitude}`
        : '0,0'
      const results = await locationSearch(term, proximity)
      setLocations(results)
    } catch (error) {
      console.warn('Location search failed:', error)
      setLocations([{ id: PLAIN_TEXT_LOCATION_ID, fullText: term }])
    } finally {
      setLoading(false)
    }
  }, [currentLocation])

  useEffect(() => {
    fetchLocations(debouncedTerm)
  }, [debouncedTerm, fetchLocations])

  return (
    <View className='rounded-2xl bg-white/80 p-2'>
      <TextInput
        className='rounded-xl bg-white px-4 py-3 text-base text-selected'
        placeholder={t('Search for your location')}
        placeholderTextColor='#33D08999'
        value={searchTerm}
        onChangeText={setSearchTerm}
        autoCapitalize='none'
        autoCorrect={false}
      />
      {loading && <ActivityIndicator style={{ marginVertical: 12 }} color='#33D089' />}
      <ScrollView keyboardShouldPersistTaps='handled' style={{ maxHeight: 280 }} nestedScrollEnabled>
        {locations.map((item, index) => (
          <LocationRow
            key={`${item.id ?? item.fullText}-${index}`}
            item={item}
            onPress={onSelect}
          />
        ))}
      </ScrollView>
    </View>
  )
}
