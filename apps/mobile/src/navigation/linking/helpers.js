import { createNavigationContainerRef } from '@react-navigation/native'

// This may no longer be useful anywhere but in `navigation/linking/index`.
// Probably should use the `useNavigation` hook anywhere else
export const navigationRef = createNavigationContainerRef()
