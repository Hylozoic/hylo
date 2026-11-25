import React from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { groupUrl } from '@hylo/navigation'
import useGroupViews from 'hooks/useGroupViews'
import useProFeature from 'hooks/useProFeature'
import { createGroupView, updateGroupView } from 'store/actions/groupViews'
import { deleteGroupViewDesignSession, saveGroupViewDesignSession } from 'store/actions/groupViewDesignSession'
import getGroupForSlug from 'store/selectors/getGroupForSlug'
import { runGraphql } from 'util/graphql'
import {
  designerSessionKey,
  resetDesignerSession,
  storedDesignerSession,
  updateDesignerSession,
  useDesignerSession
} from './designerSession'
import { isDesignSessionChanged, storeDesignerSession } from './storeDesignerSession'

export const NEW_VIEW_ID = 'new'
const DESIGNED_VIEW_ICON = 'LayoutTemplate'

/**
 * "Add to menu" (or "Save changes" for a view that already exists), shown at
 * the right of the designer's header. Saves the design in the session as a
 * 'designed' GroupView and opens the saved page. A failure is reported in the
 * chat column, which shows the session's error.
 *
 * The session is shared by the group's stewards, so it is stored first: if
 * another steward changed it since this tab loaded it, nothing is saved and the
 * session is loaded again with their changes (see storeDesignerSession).
 *
 * It sits in the page header, outside the designer's route, so the group and
 * view come in as props rather than from the route.
 */
export default function DesignerSaveButton ({ groupSlug, viewId }) {
  const { t } = useTranslation()
  const dispatch = useDispatch()
  const navigate = useNavigate()
  const group = useSelector(state => getGroupForSlug(state, groupSlug))
  const groupViews = useGroupViews(group)
  const groupId = group?.id
  const isNew = viewId === NEW_VIEW_ID
  const key = designerSessionKey(groupId, viewId)
  const session = useDesignerSession(key)
  const existingView = isNew ? null : groupViews.find(view => view.type === 'designed' && String(view.id) === String(viewId))

  const name = session.name.trim()
  // Designed views are the designedViews Pro feature. Without it (once known) a saved view can
  // still be renamed, but its design can't be changed and no new view can be added (Q-25).
  const hasDesignedViews = useProFeature(group, 'designedViews')
  const withoutPro = group?.proFeatures != null && !hasDesignedViews
  const renamed = !!existingView && name !== (existingView.name || '')
  const canSave = !!groupId && !!session.design && !!name && !session.saving && !session.sending && (
    withoutPro
      ? !isNew && renamed && !session.dirty
      : (isNew ? true : !!existingView && (session.dirty || renamed))
  )

  const handleSave = async () => {
    if (!canSave) return
    updateDesignerSession(key, { saving: true, error: null, changedByOther: false })
    const storedViewId = isNew ? null : existingView.id
    try {
      // Check no other steward changed the page since this tab loaded it (without the feature
      // nothing is stored, and only the name can change). Only their change stops the save: if the
      // session can't be stored for another reason (say it is too large), the page is saved anyway.
      const claimed = withoutPro
        ? null
        : await storeDesignerSession(dispatch, key, groupId, storedViewId, storedDesignerSession(session))
          .catch(err => { if (isDesignSessionChanged(err)) throw err; return null })
      const settings = { design: session.design }
      const response = await dispatch(isNew
        ? createGroupView({ groupId, type: 'designed', name, icon: DESIGNED_VIEW_ICON, settings, addToEnd: true })
        : updateGroupView({ id: existingView.id, groupId, name, ...(withoutPro ? {} : { settings }) }))
      if (response?.error) throw response.payload || new Error(t('Something went wrong. Please try again.'))
      const savedId = isNew ? response?.payload?.data?.createGroupView?.id : existingView.id
      if (!savedId) throw new Error(t('Something went wrong. Please try again.'))
      if (!withoutPro) {
        // Keep the conversation with the saved view; the page itself is now saved, so drop the draft.
        // A new view has no session yet. Best effort: the view is saved either way.
        await runGraphql(dispatch, saveGroupViewDesignSession(groupId, savedId, session.messages, null, isNew ? null : claimed?.version), 'saveGroupViewDesignSession').catch(() => {})
        if (isNew) await runGraphql(dispatch, deleteGroupViewDesignSession(groupId, null, claimed?.version), 'deleteGroupViewDesignSession').catch(() => {})
      }
      // The saved view is the source of truth from here on
      resetDesignerSession(key)
      if (isNew) resetDesignerSession(designerSessionKey(groupId, savedId))
      navigate(groupUrl(groupSlug, `designed/${savedId}`))
    } catch (err) {
      // Another steward's change: the session is being loaded again, and the chat says why
      if (isDesignSessionChanged(err)) return
      updateDesignerSession(key, { saving: false, error: err?.message || String(err) })
    }
  }

  return (
    <button
      type='button'
      onClick={handleSave}
      disabled={!canSave}
      data-testid='designer-save'
      className='rounded-md bg-primary text-primary-foreground px-3 py-1.5 text-sm font-bold border-2 border-transparent disabled:opacity-50 whitespace-nowrap'
    >
      {session.saving ? t('Saving...') : (isNew ? t('Add to menu') : t('Save changes'))}
    </button>
  )
}
