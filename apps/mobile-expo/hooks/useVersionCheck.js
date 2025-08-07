import { useEffect } from 'react'
import { Alert } from 'react-native'
import { apiHost } from '@hylo/shared'

/**
 * Hook to check if the app version is up to date
 * Shows an alert if an update is needed
 */
export function useVersionCheck() {
  useEffect(() => {
    const checkVersion = async () => {
      try {
        const response = await fetch(`${apiHost}/noo/version`)
        const data = await response.json()
        
        // TODO: Implement version comparison logic
        // For now, just log the version info
        console.log('Version check response:', data)
      } catch (error) {
        console.error('Version check failed:', error)
      }
    }

    checkVersion()
  }, [])
} 