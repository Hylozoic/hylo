import { useCallback } from 'react'
import { useAuth } from '@hylo/contexts/AuthContext'
import { logoutServices } from '../services/logoutServices'

export default function useLogout () {
  const { logout } = useAuth()

  return useCallback(async () => {
    try {
      await logout()
      await logoutServices()
    } catch (error) {
      console.warn('Logout failed:', (error as Error).message)
    }
  }, [logout])
}
