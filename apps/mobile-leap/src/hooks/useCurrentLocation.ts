import { useCallback, useState } from 'react'
import * as Location from 'expo-location'

export default function useCurrentLocation () {
  const [fetching, setFetching] = useState(false)
  const [currentLocation, setCurrentLocation] = useState<Location.LocationObject | null>(null)

  const getLocation = useCallback(async () => {
    setFetching(true)
    try {
      const { status } = await Location.requestForegroundPermissionsAsync()
      if (status !== 'granted') {
        setCurrentLocation(null)
        return null
      }

      const position = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced
      })
      setCurrentLocation(position)
      return position
    } catch (error) {
      console.warn('Failed to get current location:', error)
      setCurrentLocation(null)
      return null
    } finally {
      setFetching(false)
    }
  }, [])

  return [{ currentLocation, fetching }, getLocation] as const
}
