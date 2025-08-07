import { useEffect } from 'react'
import useOpenURL from './useOpenURL'
import useLinkingStore from '../navigation/linking/store'

export default function useOpenInitialURL (loading, wait = 0) {
  const openURL = useOpenURL()
  const { initialURL, setInitialURL } = useLinkingStore()

  const openInitialURL = async () => {
    if (!loading && initialURL) {
      setTimeout(() => {
        setInitialURL(null)
        openURL(initialURL)
      }, wait)
    } else {
      setInitialURL(null)
    }
  }

  useEffect(() => {
    openInitialURL()
  }, [loading, initialURL])

  return initialURL
}