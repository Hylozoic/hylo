import React from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { groupUrl } from '@hylo/navigation'
import useGroupViews from 'hooks/useGroupViews'
import { createGroupView, updateGroupView } from 'store/actions/groupViews'
import getGroupForSlug from 'store/selectors/getGroupForSlug'
import {
  designerSessionKey,
  resetDesignerSession,
  updateDesignerSession,
  useDesignerSession
} from './designerSession'

export const NEW_VIEW_ID = 'new'
const DESIGNED_VIEW_ICON = 'LayoutTemplate'

/**
 * "Add to menu" (or "Save changes" for a view that already exists), shown at
 * the right of the designer's header. Saves the design in the session as a
 * 'designed' GroupView and opens the saved page. A failure is reported in the
 * chat column, which shows the session's error.
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
  const canSave = !!groupId && !!session.design && !!name && !session.saving && !session.sending &&
    group?.hasPro !== false && (isNew ? true : !!existingView && (session.dirty || name !== (existingView.name || '')))

  const handleSave = async () => {
    if (!canSave) return
    updateDesignerSession(key, { saving: true, error: null })
    try {
      const settings = { design: session.design }
      const response = await dispatch(isNew
        ? createGroupView({ groupId, type: 'designed', name, icon: DESIGNED_VIEW_ICON, settings, addToEnd: true })
        : updateGroupView({ id: existingView.id, groupId, name, settings }))
      if (response?.error) throw response.payload || new Error(t('Something went wrong. Please try again.'))
      const savedId = isNew ? response?.payload?.data?.createGroupView?.id : existingView.id
      if (!savedId) throw new Error(t('Something went wrong. Please try again.'))
      // The saved view is the source of truth from here on
      resetDesignerSession(key)
      if (isNew) resetDesignerSession(designerSessionKey(groupId, savedId))
      navigate(groupUrl(groupSlug, `designed/${savedId}`))
    } catch (err) {
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
