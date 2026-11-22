import { useEffect } from 'react'
import { useDispatch } from 'react-redux'
import { designedViewImageUrls } from '@hylo/shared'
import useGroupViews from 'hooks/useGroupViews'
import { hasProFeature } from 'hooks/useProFeature'
import fetchGroupViews from 'store/actions/fetchGroupViews'
import { fetchGroupViewDesignSession, saveGroupViewDesignSession } from 'store/actions/groupViewDesignSession'
import { runGraphql } from 'util/graphql'
import { NEW_VIEW_ID } from './DesignerSaveButton'
import {
  designerSessionKey,
  imagesFromUrls,
  restoreDesignerSession,
  storedDesignerSession,
  updateDesignerSession,
  useDesignerSession
} from './designerSession'

// How long to wait after the last change before storing the session
export const STORE_DELAY_MS = 800

/**
 * Loads the steward's design session for this view when the designer opens, and stores it on
 * the server as it changes (decision Q-27 on #1782), so the chat with Axl and an unsaved page
 * survive a reload. Opening a saved view starts from its saved page unless the stored one was
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
      const { messages, draft } = JSON.parse(snapshot)
      runGraphql(dispatch, saveGroupViewDesignSession(groupId, isNew ? null : viewId, messages, draft), 'saveGroupViewDesignSession')
        .then(() => updateDesignerSession(key, { storedSnapshot: snapshot }))
        // Storing is best effort: the session is still in the tab, and the next change tries again
        .catch(() => {})
    }, STORE_DELAY_MS)
    return () => clearTimeout(timer)
  }, [changed, canStore, snapshot, dispatch, groupId, isNew, viewId, key])

  return { session, existingView, isNew }
}
