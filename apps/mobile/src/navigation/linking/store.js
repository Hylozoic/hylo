import { create } from 'zustand'

const useLinkingStore = create((set) => ({
  initialURL: null,
  returnToOnAuthPath: null,
  setInitialURL: initialURL => set({ initialURL }),
  setReturnToOnAuthPath: returnToOnAuthPath => set({ returnToOnAuthPath })
}))

export default useLinkingStore
