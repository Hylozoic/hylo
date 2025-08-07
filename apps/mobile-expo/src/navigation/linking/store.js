import { create } from 'zustand'

const useLinkingStore = create((set) => ({
  initialURL: null,
  setInitialURL: (url) => set({ initialURL: url }),
  returnToOnAuthPath: null,
  setReturnToOnAuthPath: (path) => set({ returnToOnAuthPath: path })
}))

export default useLinkingStore