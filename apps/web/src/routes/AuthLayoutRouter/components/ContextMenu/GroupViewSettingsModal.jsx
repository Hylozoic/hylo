import { isEqual } from 'lodash/fp'
import React, { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useDispatch } from 'react-redux'
import { House, Trash2 } from 'lucide-react'

import Button from 'components/ui/button'
import { Input } from 'components/ui/input'
import HyloEditor from 'components/HyloEditor'
import SwitchStyled from 'components/SwitchStyled'
import GroupViewIcon from './GroupViewIcon'
import { displayNameForView } from '@hylo/presenters/GroupViewPresenter'
import { deleteGroupView, setHomeView, updateGroupView, updateSpace } from 'store/actions/groupViews'
import fetchGroupViews from 'store/actions/fetchGroupViews'
import fetchForGroup from 'store/actions/fetchForGroup'
import { updateGroupSettings } from 'routes/GroupSettings/GroupSettings.store'
import { canDeleteView } from 'store/models/GroupView'
import { cn } from 'util/index'

/** Settings modal for editing a single GroupView row. */
export default function GroupViewSettingsModal ({ view, group, onClose }) {
  const { t } = useTranslation()
  const dispatch = useDispatch()
  const editorRef = useRef()
  const [name, setName] = useState(view?.name || '')
  const [link, setLink] = useState(view?.link || '')
  const [description, setDescription] = useState(view?.linkedGroup?.description || '')
  const [showWelcomePage, setShowWelcomePage] = useState(group?.settings?.showWelcomePage ?? true)
  const [isSaving, setIsSaving] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  useEffect(() => {
    setName(view?.name || '')
    setLink(view?.link || '')
    setDescription(view?.linkedGroup?.description || '')
    setShowWelcomePage(group?.settings?.showWelcomePage ?? true)
  }, [view?.id, group?.settings?.showWelcomePage, view?.name, view?.link, view?.linkedGroup?.description])

  const handleSave = useCallback(async () => {
    if (!view?.id || !group?.id) return
    setIsSaving(true)
    try {
      if (view.type === 'welcome') {
        const pageContent = editorRef.current?.getHTML?.() ?? view.pageContent
        await dispatch(updateGroupView({ id: view.id, pageContent }))
        if (!isEqual(showWelcomePage, group.settings?.showWelcomePage)) {
          await dispatch(updateGroupSettings(group.id, { settings: { showWelcomePage } }))
        }
        if (pageContent !== group.welcomePage) {
          await dispatch(updateGroupSettings(group.id, { welcomePage: pageContent }))
        }
      } else if (view.type === 'space' && view.linkedGroup?.id) {
        await dispatch(updateSpace({
          id: view.linkedGroup.id,
          name: name || view.linkedGroup.name,
          description: description || null
        }))
        if (name && name !== view.name) {
          await dispatch(updateGroupView({ id: view.id, name }))
        }
      } else if (view.type === 'link') {
        await dispatch(updateGroupView({ id: view.id, name: name || null, link }))
      } else if (['custom', 'text'].includes(view.type)) {
        await dispatch(updateGroupView({ id: view.id, name: name || null }))
      } else if (name !== view.name) {
        await dispatch(updateGroupView({ id: view.id, name: name || null }))
      }
      await dispatch(fetchGroupViews(group.id))
      onClose()
    } catch (error) {
      console.error('Failed to save view settings:', error)
    } finally {
      setIsSaving(false)
    }
  }, [dispatch, view, group, name, link, description, showWelcomePage, onClose])

  const handleSetHome = useCallback(async () => {
    if (!view?.id || !group?.id) return
    if (!window.confirm(t('Set this view as the home view for the group?'))) return
    try {
      await dispatch(setHomeView({ viewId: view.id, groupId: group.id }))
      await dispatch(fetchGroupViews(group.id))
      await dispatch(fetchForGroup(group.slug))
      onClose()
    } catch (error) {
      console.error('Failed to set home view:', error)
    }
  }, [dispatch, view?.id, group, onClose, t])

  const handleDelete = useCallback(async () => {
    if (!view?.id || !group?.id || !canDeleteView(view)) return
    const label = displayNameForView(view, t)
    if (!window.confirm(t('Are you sure you want to remove {{name}} from the menu?', { name: label }))) return
    setIsDeleting(true)
    try {
      await dispatch(deleteGroupView(view.id, group.id))
      onClose()
    } catch (error) {
      console.error('Failed to delete view:', error)
    } finally {
      setIsDeleting(false)
    }
  }, [dispatch, view, group?.id, onClose, t])

  if (!view) return null

  const title = displayNameForView(view, t)
  const isHome = view.order === 0
  const deletable = canDeleteView(view)

  return (
    <div className='fixed inset-0 z-50 flex items-center justify-center bg-darkening/50'>
      <div className='bg-midground rounded-lg shadow-lg p-4 w-full max-w-lg max-h-[85vh] overflow-y-auto'>
        <h2 className='text-lg font-semibold mb-4 flex items-center gap-2'>
          <GroupViewIcon view={view} />
          {title}
        </h2>

        <div className='flex flex-col gap-3'>
          {view.type === 'welcome' && (
            <>
              <div className='flex items-center gap-2'>
                <SwitchStyled
                  checked={showWelcomePage}
                  onChange={() => setShowWelcomePage(v => !v)}
                  backgroundColor={showWelcomePage ? 'hsl(var(--selected))' : 'rgba(0 0 0 / .6)'}
                />
                <span className='text-sm text-foreground/80'>
                  {t('Show this welcome page to new members when they first land in the group.')}
                </span>
              </div>
              <HyloEditor
                key={view.id}
                contentHTML={view.pageContent || group?.welcomePage}
                className='min-h-32 p-2 border border-foreground/20 rounded-lg bg-input'
                extendedMenu
                groupIds={[group.id]}
                ref={editorRef}
                showMenu
                type='welcomePage'
              />
            </>
          )}

          {view.type === 'space' && (
            <>
              <label className='text-sm text-foreground/70'>{t('Name')}</label>
              <Input value={name} onChange={e => setName(e.target.value)} placeholder={view.linkedGroup?.name} />
              <label className='text-sm text-foreground/70'>{t('Description')}</label>
              <textarea
                value={description}
                onChange={e => setDescription(e.target.value)}
                rows={3}
                className='w-full rounded-md border border-foreground/20 bg-input p-2 text-sm text-foreground'
              />
            </>
          )}

          {view.type === 'link' && (
            <>
              <label className='text-sm text-foreground/70'>{t('Name')}</label>
              <Input value={name} onChange={e => setName(e.target.value)} />
              <label className='text-sm text-foreground/70'>{t('URL')}</label>
              <Input value={link} onChange={e => setLink(e.target.value)} />
            </>
          )}

          {['custom', 'text'].includes(view.type) && (
            <>
              <label className='text-sm text-foreground/70'>{t('Name')}</label>
              <Input value={name} onChange={e => setName(e.target.value)} />
            </>
          )}

          {!['welcome', 'space', 'link', 'custom', 'text', 'separator'].includes(view.type) && view.type !== 'separator' && (
            <>
              <label className='text-sm text-foreground/70'>{t('Display name (optional)')}</label>
              <Input value={name} onChange={e => setName(e.target.value)} placeholder={title} />
            </>
          )}
        </div>

        <div className='flex flex-wrap gap-2 mt-4 pt-4 border-t border-foreground/10'>
          {!isHome && view.type !== 'separator' && view.type !== 'text' && view.type !== 'link' && (
            <Button variant='secondary' onClick={handleSetHome} className='flex items-center gap-1'>
              <House className='w-4 h-4' />
              {t('Set as Home View')}
            </Button>
          )}
          {deletable && (
            <Button variant='secondary' disabled={isDeleting} onClick={handleDelete} className='flex items-center gap-1 text-destructive'>
              <Trash2 className='w-4 h-4' />
              {t('Remove from Menu')}
            </Button>
          )}
          <div className='flex-1' />
          <Button variant='secondary' onClick={onClose}>{t('Cancel')}</Button>
          <Button variant='primary' disabled={isSaving} onClick={handleSave}>
            {isSaving ? t('Saving...') : t('Save')}
          </Button>
        </div>
      </div>
    </div>
  )
}

/** Inline gear/trash controls shown on hover in edit mode. */
export function GroupViewEditActions ({ view, onSettings, onDelete, className }) {
  const deletable = canDeleteView(view)
  return (
    <div className={cn('flex items-center gap-1 shrink-0', className)}>
      <button
        type='button'
        className='p-1 text-foreground/50 hover:text-foreground rounded'
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); onSettings(view) }}
        aria-label='Settings'
      >
        <SettingsIcon />
      </button>
      {deletable && (
        <button
          type='button'
          className='p-1 text-foreground/50 hover:text-destructive rounded'
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); onDelete(view) }}
          aria-label='Remove'
        >
          <Trash2 className='w-4 h-4' />
        </button>
      )}
    </div>
  )
}

function SettingsIcon () {
  return (
    <svg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2' strokeLinecap='round' strokeLinejoin='round'>
      <path d='M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z' />
      <circle cx='12' cy='12' r='3' />
    </svg>
  )
}
