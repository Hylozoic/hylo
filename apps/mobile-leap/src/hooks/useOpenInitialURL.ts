import { useEffect } from 'react'
import useOpenURL from './useOpenURL'
import useLinkingStore from '../navigation/linking/store'

export default function useOpenInitialURL (loading: boolean, wait = 0) {
  const openURL = useOpenURL()
  const { initialURL, setInitialURL } = useLinkingStore()

  useEffect(() => {
    if (!loading && initialURL) {
      const timer = setTimeout(() => {
        setInitialURL(null)
        openURL(initialURL).catch(err => console.warn('openInitialURL failed:', err))
      }, wait)
      return () => clearTimeout(timer)
    }
  }, [loading, initialURL, openURL, setInitialURL, wait])

  return initialURL
}
