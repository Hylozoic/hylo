import { useEffect } from 'react'
import { useContextGroups } from '@hylo/hooks/useCurrentGroup'
import useRouteParams from 'hooks/useRouteParams'
import useChangeToGroup from 'hooks/useChangeToGroup'
import useOpenInitialURL from 'hooks/useOpenInitialURL'
import useReturnToOnAuthPath from 'hooks/useReturnToOnAuthPath'

export const useHandleLinking = () => {
  const changeToGroup = useChangeToGroup()
  const { myContext, publicContext } = useContextGroups()
  const { context, groupSlug } = useRouteParams()

  // The following 3 steps are the final steps in linking within the app:

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

  // === :context and :groupSlug path match handling ===
  // The context and groupSlug are retrieved from the screen params added by
  // any link that has those named params. They are used here to set that
  // context/group as current. The remaining route params from the matched link
  // are handled in the final component in the screen path (e.g. id for a
  // post/:id path match is retrieved in the PostDetails component).
  useEffect(() => {
    if (context === 'groups' && groupSlug) {
      changeToGroup(groupSlug, { skipCanViewCheck: true })
    } else if ([myContext.slug, publicContext.slug].includes(context)) {
      changeToGroup(context)
    }
  }, [context, groupSlug])

  return { initialURL, returnToOnAuthPath }
}

export default useHandleLinking
