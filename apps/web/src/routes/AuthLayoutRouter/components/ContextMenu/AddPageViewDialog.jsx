import React, { useCallback, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import { useDispatch } from 'react-redux'

import Button from 'components/ui/button'
import { Input } from 'components/ui/input'
import HyloEditor from 'components/HyloEditor'
import LucideIconPicker from 'components/LucideIconPicker/LucideIconPicker'
import { createGroupView } from 'store/actions/groupViews'

const DEFAULT_PAGE_ICON = 'FileText'

/** Modal for configuring a new Page view before creation.
 * Pass `onAdd` to stage the view locally instead of dispatching a mutation (see AddGroupViewDialog). */
export default function AddPageViewDialog ({ group, onCancel, onCreated, onAdd }) {
  const { t } = useTranslation()
  const dispatch = useDispatch()
  const pageEditorRef = useRef()
  const [name, setName] = useState('')
  const [icon, setIcon] = useState(DEFAULT_PAGE_ICON)
  const [isSaving, setIsSaving] = useState(false)

  const canSave = name.trim().length > 0

  const handleSave = useCallback(async () => {
    if (!canSave) return
    const pageContent = pageEditorRef.current?.getHTML?.() || ''
    const viewData = {
      type: 'page',
      name: name.trim(),
      icon,
      pageContent,
      addToEnd: true
    }

    if (onAdd) {
      onAdd(viewData)
      return
    }

    if (!group?.id) return
    setIsSaving(true)
    try {
      await dispatch(createGroupView({
        groupId: group.id,
        ...viewData
      }))
      onCreated()
    } catch (error) {
      console.error('Failed to create page view:', error)
    } finally {
      setIsSaving(false)
    }
  }, [canSave, dispatch, group?.id, icon, name, onAdd, onCreated])

  // Portal above AuthLayout nav stacking so the dialog is not trapped behind GlobalNav.
  return createPortal(
    <div data-hylo-nested-dialog className='fixed inset-0 z-[1100] flex items-center justify-center bg-darkening/50 p-4 pointer-events-auto'>
      <div className='bg-midground rounded-lg shadow-lg p-4 w-full max-w-[750px] h-[calc(100vh-2rem)] flex flex-col'>
        <h2 className='text-lg font-semibold mb-4 shrink-0'>{t('Add Page')}</h2>

        <div className='flex flex-col gap-3 flex-1 min-h-0'>
          <div className='flex flex-col gap-1 shrink-0'>
            <label className='text-sm text-foreground/70'>{t('Name')}</label>
            <Input value={name} onChange={e => setName(e.target.value)} placeholder={t('Name')} />
          </div>
          <div className='flex flex-col gap-1 shrink-0'>
            <label className='text-sm text-foreground/70'>{t('Icon')}</label>
            <LucideIconPicker value={icon} onChange={setIcon} />
          </div>
          <HyloEditor
            contentHTML=''
            className='min-h-0 flex-1 overflow-y-auto p-2 [&_.ProseMirror]:min-h-full'
            containerClassName='hyloEditor flex flex-col flex-1 min-h-0 border border-foreground/20 rounded-lg bg-input'
            extendedMenu
            groupIds={group?.id ? [group.id] : []}
            ref={pageEditorRef}
            showMenu
            type='welcomePage'
          />
        </div>

        <div className='flex justify-end gap-2 mt-4 pt-2 border-t border-foreground/10 shrink-0'>
          <Button variant='primary' onClick={onCancel}>{t('Back')}</Button>
          <Button variant='secondary' disabled={!canSave || isSaving} onClick={handleSave}>
            {isSaving ? t('Creating...') : t('Add View')}
          </Button>
        </div>
      </div>
    </div>,
    document.body
  )
}
