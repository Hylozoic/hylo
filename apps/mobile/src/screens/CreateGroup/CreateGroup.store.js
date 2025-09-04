import { create } from 'zustand'
import { DEFAULT_ACCESSIBILITY_OPTION, DEFAULT_VISIBILITY_OPTION } from './CreateGroupVisibilityAccessibility'

const initialState = {
  groupData: {
    name: '',
    slug: null,
    purpose: '',
    visibility: DEFAULT_VISIBILITY_OPTION,
    accessibility: DEFAULT_ACCESSIBILITY_OPTION,
    parentGroups: []
  },
  disableContinue: false,
  edited: false,
  currentStep: 0,
  submit: false,
  isSubmitting: false
}

export const useCreateGroupStore = create((set, get) => ({
  ...initialState,

  setEdited: (edited) => set({ edited }),

  setDisableContinue: (disableContinue) => set({ disableContinue }),

  updateGroupData: (updates) =>
    set((state) => ({
      groupData: { ...state.groupData, ...updates },
      edited: true
    })),

  // https://github.com/Hylozoic/hylo/blob/0cc010845b1c9fa9354ad678dd09fca992ae30e2/apps/backend/api/graphql/schema.graphql#L2938-L2939
  getMutationData: () => {
    const groupData = get().groupData
    return {
      name: groupData.name,
      slug: groupData.slug,
      purpose: groupData.purpose,
      visibility: groupData.visibility ? groupData.visibility.value : null,
      accessibility: groupData.accessibility ? groupData.accessibility.value : null,
      parentIds: groupData.parentGroups.map(parentGroup => parentGroup.id)
    }
  },

  goNext: (totalSteps) => {
    if (get().currentStep < totalSteps - 1) {
      set((state) => ({ currentStep: state.currentStep + 1 }))
    }
  },

  goBack: (navigation) => {
    if (get().currentStep > 0) {
      set((state) => ({ currentStep: state.currentStep - 1 }))
    } else {
      // Close flow if on first step
      navigation.navigate('Drawer')
    }
  },

  goToStep: currentStep => set({ currentStep }),

  resetSteps: () => set({ currentStep: 0 }),

  clearStore: () => set(() => ({ ...initialState })),

  setSubmit: submit => set({ submit }),

  setIsSubmitting: isSubmitting => set({ isSubmitting })
}))
