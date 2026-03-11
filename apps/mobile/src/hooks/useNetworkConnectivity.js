import { useState, useEffect } from 'react'
import NetInfo from '@react-native-community/netinfo'

/**
 * Hook to monitor network connectivity status
 * Returns whether the device is connected to the internet
 * and sets up a listener to update when connectivity changes
 */
export default function useNetworkConnectivity () {
  const [isConnected, setIsConnected] = useState(true)
  const [isInternetReachable, setIsInternetReachable] = useState(true)

  useEffect(() => {
    // Fetch initial connectivity status
    NetInfo.fetch().then(state => {
      setIsConnected(state.isConnected ?? false)
      setIsInternetReachable(state.isInternetReachable ?? false)
    })

    // Set up listener for connectivity changes
    const unsubscribe = NetInfo.addEventListener(state => {
      setIsConnected(state.isConnected ?? false)
      setIsInternetReachable(state.isInternetReachable ?? false)
    })

    // Cleanup listener on unmount
    return () => {
      unsubscribe()
    }
  }, [])

  return {
    isConnected,
    isInternetReachable
  }
}
