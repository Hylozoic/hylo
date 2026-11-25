import fetchGroupViews from 'store/actions/fetchGroupViews'
import { DESIGN_SESSION_CHANGED, saveGroupViewDesignSession } from 'store/actions/groupViewDesignSession'
import { runGraphql } from 'util/graphql'
import { authorsById, getDesignerSession, updateDesignerSession } from './designerSession'

// One store at a time per session, so a tab never refuses its own change for an old version
const queues = new Map()

export function isDesignSessionChanged (error) {
  return error?.extensions?.code === DESIGN_SESSION_CHANGED
}

/**
 * Stores `stored` ({ messages, draft }, see storedDesignerSession) as the shared session for this
 * view, sending the version this tab last saw. On success the session's version, stored snapshot
 * and authors are updated and the stored session is returned. If another steward changed the
 * session since (DESIGN_SESSION_CHANGED), the session is loaded again (see reloadDesignerSession)
 * and the error is thrown for the caller to handle.
 */
export function storeDesignerSession (dispatch, key, groupId, viewId, stored) {
  const run = async () => {
    const { version } = getDesignerSession(key)
    try {
      const result = await runGraphql(dispatch, saveGroupViewDesignSession(groupId, viewId, stored.messages, stored.draft, version), 'saveGroupViewDesignSession')
      updateDesignerSession(key, current => ({
        version: result?.version ?? current.version,
        authors: { ...current.authors, ...authorsById(result?.authors) },
        storedSnapshot: JSON.stringify(stored)
      }))
      return result
    } catch (err) {
      if (isDesignSessionChanged(err)) await reloadDesignerSession(dispatch, key, groupId)
      throw err
    }
  }
  const next = (queues.get(key) || Promise.resolve()).catch(() => {}).then(run)
  queues.set(key, next)
  return next
}

/**
 * Another steward changed the shared session: load it, and the group's views (they may have saved
 * the page), again. useStoredDesignerSession does the loading once `loaded` is false; the chat
 * says why the page changed.
 */
export async function reloadDesignerSession (dispatch, key, groupId) {
  await Promise.resolve(dispatch(fetchGroupViews(groupId))).catch(() => {})
  updateDesignerSession(key, { loaded: false, loading: false, sending: false, saving: false, storedSnapshot: null, changedByOther: true })
}
