import { useEffect } from 'react'
import { useDispatch } from 'react-redux'
import { designedViewImageUrls } from '@hylo/shared'
import useGroupViews from 'hooks/useGroupViews'
import { hasProFeature } from 'hooks/useProFeature'
import fetchGroupViews from 'store/actions/fetchGroupViews'
import { fetchGroupViewDesignSession } from 'store/actions/groupViewDesignSession'
import { runGraphql } from 'util/graphql'
import { NEW_VIEW_ID } from './DesignerSaveButton'
import {
  designerSessionKey,
  getDesignerSession,
  imagesFromUrls,
  restoreDesignerSession,
  storedDesignerSession,
  updateDesignerSession,
  useDesignerSession
} from './designerSession'
import { storeDesignerSession } from './storeDesignerSession'

// How long to wait after the last change before storing the session
export const STORE_DELAY_MS = 800

/**
 * Loads the design session for this view when the designer opens, and stores it on the server as
 * it changes (decision Q-27 on #1782), so the chat with Axl and an unsaved page survive a reload.
 * The session is shared by the group's stewards (decision V-05): if another steward changed it
 * since this tab loaded it, storing is refused and the session is loaded again (see
 * storeDesignerSession). Opening a saved view starts from its saved page unless the stored one was
 * changed. Used by the designer's main column, which is mounted on phones and desktops alike.
 *
 * A group without the designedViews Pro feature can still see what was stored, but nothing new
 * is stored for it: its design can't be changed.
 */
export default function useStoredDesignerSession (group, viewId) {
  const dispatch = useDispatch()
  const groupViews = useGroupViews(group)
  const groupId = group?.id
  const isNew = viewId === NEW_VIEW_ID
  const key = designerSessionKey(groupId, viewId)
  const session = useDesignerSession(key)
  const existingView = isNew ? null : groupViews.find(view => view.type === 'designed' && String(view.id) === String(viewId))
  const groupViewsLoaded = group?.groupViews != null
  const canStore = hasProFeature(group, 'designedViews')
  // Without the feature a stored unsaved page can't be saved, so the designer opens on the saved one
  // (which can still be renamed)
  const withoutFeature = group?.proFeatures != null && !canStore

  useEffect(() => {
    if (groupId && !groupViewsLoaded) dispatch(fetchGroupViews(groupId))
  }, [dispatch, groupId, groupViewsLoaded])

  // The session is shared, so opening the designer again loads it again to show what other
  // stewards did meanwhile, unless this tab has a change not stored yet or a turn under way
  useEffect(() => {
    const current = getDesignerSession(key)
    if (!current.loaded || current.sending || current.saving) return
    if (JSON.stringify(storedDesignerSession(current)) === current.storedSnapshot) {
      updateDesignerSession(key, { loaded: false })
    }
  }, [key])

  useEffect(() => {
    if (!groupId || session.loaded || session.loading) return
    if (!isNew && !existingView) return
    updateDesignerSession(key, { loading: true })
    const savedDesign = existingView?.settings?.design || null
    const saved = isNew
      ? {}
      : { design: savedDesign, name: existingView.name || '', images: imagesFromUrls(designedViewImageUrls(savedDesign)) }
    runGraphql(dispatch, fetchGroupViewDesignSession(groupId, isNew ? null : existingView.id), 'groupViewDesignSession')
      // Without the stored session the designer still works from the saved page
      .catch(() => null)
      .then(stored => {
        const usable = stored && withoutFeature && !isNew ? { ...stored, draft: null } : stored
        updateDesignerSession(key, current => {
          const restored = { ...current, ...restoreDesignerSession(saved, usable) }
          return { ...restored, loaded: true, loading: false, storedSnapshot: JSON.stringify(storedDesignerSession(restored)) }
        })
      })
  }, [dispatch, groupId, isNew, existingView, session.loaded, session.loading, key, withoutFeature])

  const snapshot = session.loaded ? JSON.stringify(storedDesignerSession(session)) : null
  const changed = !!snapshot && snapshot !== session.storedSnapshot && !session.saving
  useEffect(() => {
    if (!changed || !canStore) return
    const timer = setTimeout(() => {
      storeDesignerSession(dispatch, key, groupId, isNew ? null : viewId, JSON.parse(snapshot))
        // Storing is best effort: the session is still in the tab, and the next change tries again.
        // If another steward changed it, it has been loaded again with their changes.
        .catch(() => {})
    }, STORE_DELAY_MS)
    return () => clearTimeout(timer)
  }, [changed, canStore, snapshot, dispatch, groupId, isNew, viewId, key])

  return { session, existingView, isNew }
}
