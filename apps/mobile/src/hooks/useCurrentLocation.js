import { useState } from 'react'
import { Alert, Linking, Platform, PermissionsAndroid, ToastAndroid } from 'react-native'
import Geolocation from 'react-native-geolocation-service'

export default function useCurrentLocation () {
  const [loading, setLoading] = useState(false)
  const [forceLocation, setForceLocation] = useState(true)
  const [highAccuracy, setHighAccuracy] = useState(true)
  const [locationDialog, setLocationDialog] = useState(true)
  const [useLocationManager, setUseLocationManager] = useState(false)
  const [currentLocation, setCurrentLocation] = useState(null)

  const hasPermissionIOS = async () => {
    const openSetting = () => {
      Linking.openSettings().catch(() => {
        Alert.alert('Unable to open settings')
      })
    }
    const status = await Geolocation.requestAuthorization('whenInUse')

    if (status === 'granted') {
      return true
    }

    if (status === 'denied') {
      Alert.alert('Location permission denied')
    }

    if (status === 'disabled') {
      Alert.alert(
        'Turn on Location Services to allow "Hylo" to determine your location.',
        '',
        [
          { text: 'Go to Settings', onPress: openSetting },
          { text: "Don't Use Location", onPress: () => {} }
        ]
      )
    }

    return false
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
      PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
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

    let resolve, reject;
    const promise = new Promise((res, rej) => {
      resolve = res
      reject = rej
    })

    Geolocation.getCurrentPosition(
      (position) => {
        setCurrentLocation(position)
        setLoading(false)
        resolve(position)
      },
      (error) => {
        Alert.alert(`Code ${error.code}`, error.message)
        setCurrentLocation(null)
        setLoading(false)
        resolve(null)
      },
      {
        accuracy: {
          android: 'high',
          ios: 'best'
        },
        enableHighAccuracy: highAccuracy,
        timeout: 15000,
        maximumAge: 10000,
        distanceFilter: 0,
        forceRequestLocation: forceLocation,
        forceLocationManager: useLocationManager,
        showLocationDialog: locationDialog
      }
    )

    return promise
  }

  return [{ currentLocation, fetching: loading }, getLocation]
}
