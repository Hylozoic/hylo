import React, { useCallback, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useDispatch } from 'react-redux'

import Button from 'components/ui/button'
import HyloEditor from 'components/HyloEditor'
import SwitchStyled from 'components/SwitchStyled'
import { createGroupView } from 'store/actions/groupViews'
import { updateGroupSettings } from 'routes/GroupSettings/GroupSettings.store'

/** Modal for configuring a new Welcome view before creation.
 * Pass `onAdd` to stage the view locally instead of dispatching a mutation (see AddGroupViewDialog). */
export default function AddWelcomeViewDialog ({ group, onCancel, onCreated, onAdd }) {
  const { t } = useTranslation()
  const dispatch = useDispatch()
  const welcomeEditorRef = useRef()
  const [showWelcomePage, setShowWelcomePage] = useState(group?.settings?.showWelcomePage ?? true)
  const [isSaving, setIsSaving] = useState(false)

  const handleSave = useCallback(async () => {
    const pageContent = welcomeEditorRef.current?.getHTML?.() || ''
    const viewData = {
      type: 'welcome',
      pageContent,
      showWelcomePage,
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
        type: 'welcome',
        pageContent,
        addToEnd: true
      }))
      if (showWelcomePage !== (group.settings?.showWelcomePage ?? true)) {
        await dispatch(updateGroupSettings(group.id, { settings: { showWelcomePage } }))
      }
      onCreated()
    } catch (error) {
      console.error('Failed to create welcome view:', error)
    } finally {
      setIsSaving(false)
    }
  }, [dispatch, group, onAdd, onCreated, showWelcomePage])

  return (
    <div className='fixed inset-0 z-[1100] flex items-center justify-center bg-darkening/50 p-4 pointer-events-auto'>
      <div className='bg-midground rounded-lg shadow-lg p-5 w-full max-w-lg max-h-[85vh] flex flex-col'>
        <h2 className='text-lg font-semibold mb-4'>{t('Welcome Page')}</h2>

        <div className='overflow-y-auto flex-1 min-h-0 flex flex-col gap-3'>
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
            contentHTML=''
            className='min-h-32 p-2 border border-foreground/20 rounded-lg bg-input'
            extendedMenu
            groupIds={group?.id ? [group.id] : []}
            ref={welcomeEditorRef}
            showMenu
            type='welcomePage'
          />
        </div>

        <div className='flex justify-end gap-2 mt-4 pt-2 border-t border-foreground/10'>
          <Button variant='primary' onClick={onCancel}>{t('Back')}</Button>
          <Button variant='secondary' disabled={isSaving} onClick={handleSave}>
            {isSaving ? t('Creating...') : t('Add View')}
          </Button>
        </div>
      </div>
    </div>
  )
}
