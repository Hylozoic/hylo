// import { useEffect } from 'react'
// import useReturnToOnAuthPath from './useReturnToOnAuthPath'
// import useOpenInitialURL from './useOpenInitialURL'
// import useSetCurrentGroup from './useSetCurrentGroup'

// export default function useLinkingNavigation (loading) {
//   const setCurrentGroup = useSetCurrentGroup()
//   const goToReturnToOnAuthPath = useReturnToOnAuthPath()
//   const goToInitialURL = useOpenInitialURL()

//   useEffect(() => {
//     (async function () {
//       await setCurrentGroup(loading)
//       await goToInitialURL(loading)
//       await goToReturnToOnAuthPath(loading)
//     })()
//   })

//   return null
// }
