import { useCallback, useEffect, useMemo, useState } from 'react'
import { ActivityIndicator, FlatList, Pressable, Text, TextInput, View } from 'react-native'
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
  const mapboxLocations = coordinate
    ? await fetchMapboxLocations(`${coordinate.lng},${coordinate.lat}`)
    : await fetchMapboxLocations(searchTerm, { proximity })

  const locations: LocationItem[] = (mapboxLocations.features ?? []).map((feature: Parameters<typeof convertMapboxToLocation>[0]) => ({
    ...convertMapboxToLocation(feature),
    id: feature.id
  }))

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
    <Pressable className='border-t border-selected/30 px-3 py-3' onPress={handlePress}>
      <Text className='text-base text-selected'>
        {isGeocoded ? item.fullText : `Use "${item.fullText}" (without mapping)`}
      </Text>
    </Pressable>
  )
}

export default function LocationSelector ({ onSelect }: LocationSelectorProps) {
  const { t } = useTranslation()
  const [, getLocation] = useCurrentLocation()
  const [searchTerm, setSearchTerm] = useState('')
  const [debouncedTerm, setDebouncedTerm] = useState('')
  const [locations, setLocations] = useState<LocationItem[]>([])
  const [loading, setLoading] = useState(false)

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
      const currentLocation = await getLocation()
      const proximity = currentLocation?.coords
        ? `${currentLocation.coords.longitude},${currentLocation.coords.latitude}`
        : '0,0'
      const results = await locationSearch(term, proximity)
      setLocations(results)
    } catch (error) {
      console.warn('Location search failed:', error)
      setLocations([])
    } finally {
      setLoading(false)
    }
  }, [getLocation])

  useEffect(() => {
    fetchLocations(debouncedTerm)
  }, [debouncedTerm, fetchLocations])

  const listHeader = useMemo(() => (
    <TextInput
      className='rounded-2xl bg-white/80 px-4 py-3 text-base text-selected'
      placeholder={t('Search for your location')}
      placeholderTextColor='#33D08999'
      value={searchTerm}
      onChangeText={setSearchTerm}
      autoCapitalize='none'
      autoCorrect={false}
    />
  ), [searchTerm, t])

  return (
    <View>
      {listHeader}
      {loading && <ActivityIndicator style={{ marginVertical: 16 }} color='#fff' />}
      <FlatList
        data={locations}
        keyExtractor={(item, index) => `${item.id ?? item.fullText}-${index}`}
        renderItem={({ item }) => <LocationRow item={item} onPress={onSelect} />}
        keyboardShouldPersistTaps='handled'
        style={{ maxHeight: 280 }}
      />
    </View>
  )
}
