import { useState, useEffect } from 'react'
import { Alert, Linking, Platform, PermissionsAndroid, ToastAndroid } from 'react-native'
import Geolocation from '@react-native-community/geolocation'

export default function useCurrentLocation () {
  const [loading, setLoading] = useState(false)
  const [highAccuracy] = useState(true)
  const [currentLocation, setCurrentLocation] = useState(null)

  // Configure geolocation settings once when hook is initialized
  useEffect(() => {
    Geolocation.setRNConfiguration({
      skipPermissionRequests: false, // Let the library handle permission requests
      authorizationLevel: 'whenInUse', // iOS: Request "when in use" permission
      locationProvider: 'auto' // Android: Auto-select best provider (Play Services preferred)
    })
  }, [])

  const hasPermissionIOS = async () => {
    const openSetting = () => {
      Linking.openSettings().catch(() => {
        Alert.alert('Unable to open settings')
      })
    }

    return new Promise((resolve) => {
      Geolocation.requestAuthorization(
        () => {
          // Success callback
          resolve(true)
        },
        (error) => {
          // Error callback
          if (error.code === 1) { // PERMISSION_DENIED
            Alert.alert('Location permission denied')
          } else if (error.code === 2) { // POSITION_UNAVAILABLE
            Alert.alert(
              'Turn on Location Services to allow "Hylo" to determine your location.',
              '',
              [
                { text: 'Go to Settings', onPress: openSetting },
                { text: "Don't Use Location", onPress: () => {} }
              ]
            )
          }
          resolve(false)
        }
      )
    })
  }

  const hasLocationPermission = async () => {
    if (Platform.OS === 'ios') {
      const hasPermission = await hasPermissionIOS()
      return hasPermission
    }

    if (Platform.OS === 'android' && Platform.Version < 23) {
      return true
    }

    const hasPermission = await PermissionsAndroid.check(
      PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION
    )

    if (hasPermission) {
      return true
    }

    const status = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION
    )

    if (status === PermissionsAndroid.RESULTS.GRANTED) {
      return true
    }

    if (status === PermissionsAndroid.RESULTS.DENIED) {
      ToastAndroid.show(
        'Location permission denied by user.',
        ToastAndroid.LONG
      )
    } else if (status === PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN) {
      ToastAndroid.show(
        'Location permission revoked by user.',
        ToastAndroid.LONG
      )
    }

    return false
  }

  const getLocation = async () => {
    setLoading(true)
    const hasPermission = await hasLocationPermission()

    if (!hasPermission) {
      setLoading(false)
      return
    }

    let resolvePosition
    const promise = new Promise((resolve, reject) => {
      resolvePosition = resolve
    })

    Geolocation.getCurrentPosition(
      (position) => {
        setCurrentLocation(position)
        setLoading(false)
        resolvePosition(position)
      },
      (error) => {
        Alert.alert(`Code ${error.code}`, error.message)
        setCurrentLocation(null)
        setLoading(false)
        resolvePosition(null)
      },
      {
        enableHighAccuracy: highAccuracy,
        timeout: 15000,
        maximumAge: 10000
      }
    )

    return promise
  }

  return [{ currentLocation, fetching: loading }, getLocation]
}
