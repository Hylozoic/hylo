import useOpenInitialURL from 'hooks/useOpenInitialURL'
import useReturnToOnAuthPath from 'hooks/useReturnToOnAuthPath'

export const useHandleLinking = () => {
  // === initialURL ===
  // If the app was launched via navigation to a URL this hook retrieves
  // that path and navigates to it. The value is then cleared from memory,
  // but kept here temporarily to use as a flag to disable initial animations
  // for a more seamless initial loading experience.
  const initialURL = useOpenInitialURL()

  // === returnToOnAuth ===
  // When the app is launched or brought into focus via navigation to
  // a path which requires auth, and the user is not authorized, that
  // path is stored for later use in a zustand global store and then
  // navigated to here now that we're auth'd. The memory is then cleared.
  // Generally good UX, but especially important for handling of JoinGroup.
  const returnToOnAuthPath = useReturnToOnAuthPath()

  return { initialURL, returnToOnAuthPath }
}

export default useHandleLinking
