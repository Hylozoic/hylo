import { create } from 'zustand'

type LinkingState = {
  initialURL: string | null
  returnToOnAuthPath: string | null
  setInitialURL: (initialURL: string | null) => void
  setReturnToOnAuthPath: (returnToOnAuthPath: string | null) => void
}

const useLinkingStore = create<LinkingState>((set) => ({
  initialURL: null,
  returnToOnAuthPath: null,
  setInitialURL: initialURL => set({ initialURL }),
  setReturnToOnAuthPath: returnToOnAuthPath => set({ returnToOnAuthPath })
}))

export default useLinkingStore
