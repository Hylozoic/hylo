import { useEffect, useState } from 'react'
import NetInfo from '@react-native-community/netinfo'

// Monitor network connectivity; treat null isInternetReachable as true (fail open).
export default function useNetworkConnectivity () {
  const [isConnected, setIsConnected] = useState(true)
  const [isInternetReachable, setIsInternetReachable] = useState(true)

  useEffect(() => {
    NetInfo.fetch().then(state => {
      setIsConnected(state.isConnected ?? true)
      setIsInternetReachable(state.isInternetReachable ?? true)
    })

    const unsubscribe = NetInfo.addEventListener(state => {
      setIsConnected(state.isConnected ?? true)
      setIsInternetReachable(state.isInternetReachable ?? true)
    })

    return () => unsubscribe()
  }, [])

  return { isConnected, isInternetReachable }
}
