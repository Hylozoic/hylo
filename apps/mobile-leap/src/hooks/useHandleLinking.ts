import useOpenInitialURL from './useOpenInitialURL'
import useReturnToOnAuthPath from './useReturnToOnAuthPath'

export default function useHandleLinking (loading = false) {
  const initialURL = useOpenInitialURL(loading)
  const returnToOnAuthPath = useReturnToOnAuthPath(loading)

  return { initialURL, returnToOnAuthPath }
}
