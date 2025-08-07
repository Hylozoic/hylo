import { create } from 'zustand'
import fetchJSON from '../util/fetchJSON'

const useAuthStore = create((set, get) => ({
  // Auth state
  isLoading: false,
  error: null,
  
  // Actions
  setLoading: (loading) => set({ isLoading: loading }),
  setError: (error) => set({ error }),
  clearError: () => set({ error: null }),
  
  // Social login actions
  loginWithApple: async (params) => {
    try {
      set({ isLoading: true, error: null })
      const response = await fetchJSON('/noo/login/apple/oauth', params, { method: 'post' })
      set({ isLoading: false })
      return { data: response }
    } catch (error) {
      set({ isLoading: false, error: error.message })
      return { error: { payload: { response: { body: error.message } } } }
    }
  },
  
  loginWithGoogle: async (accessToken) => {
    try {
      set({ isLoading: true, error: null })
      const response = await fetchJSON(`/noo/login/google-token/oauth?access_token=${accessToken}`, {}, { method: 'post' })
      set({ isLoading: false })
      return { data: response }
    } catch (error) {
      set({ isLoading: false, error: error.message })
      return { error: { payload: { response: { body: error.message } } } }
    }
  }
}))

export default useAuthStore