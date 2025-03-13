import { PUBLIC_CONTEXT_SLUG, MY_CONTEXT_SLUG } from '@hylo/shared'
import { getStaticContext } from '@hylo/presenters/GroupPresenter'
import useCurrentUser from './useCurrentUser'

export default function useStaticContexts () {
  const [{ currentUser }] = useCurrentUser()

  return {
    myContext: getStaticContext(MY_CONTEXT_SLUG, { currentUser }),
    publicContext: getStaticContext(PUBLIC_CONTEXT_SLUG, { currentUser })
  }
}
