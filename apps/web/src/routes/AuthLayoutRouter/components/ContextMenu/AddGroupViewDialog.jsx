import React, { useCallback, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useDispatch } from 'react-redux'
import { Plus } from 'lucide-react'

import Button from 'components/ui/button'
import Checkbox from 'components/ui/checkbox'
import { Input } from 'components/ui/input'
import LucideIconPicker from 'components/LucideIconPicker/LucideIconPicker'
import GroupViewIcon from './GroupViewIcon'
import AddCustomViewDialog from './AddCustomViewDialog'
import GroupViewPresenter, { displayNameForView } from '@hylo/presenters/GroupViewPresenter'
import { createGroupView } from 'store/actions/groupViews'
import { cn } from 'util/index'

/** View types that can be added from the menu editor without picking an entity. */
const ADDABLE_GROUP_VIEW_TYPES = [
  'all',
  'discussions',
  'events',
  'resources',
  'projects',
  'proposals',
  'requests-and-offers',
  'map',
  'members',
  'chat',
  'welcome',
  'about',
  'related-groups',
  'custom',
  'link',
  'text',
  'separator'
]

/** System views that can only appear once in a group's menu. */
const SINGLETON_VIEW_TYPES = new Set([
  'all',
  'discussions',
  'events',
  'resources',
  'projects',
  'proposals',
  'requests-and-offers',
  'map',
  'members',
  'chat',
  'welcome',
  'about',
  'related-groups'
])

/** Short description shown on the right side of each add-view row. */
function descriptionForViewType (type, t) {
  return t(`addViewDesc-${type}`, { defaultValue: '' })
}

/** Modal for picking and creating a new group view. */
export default function AddGroupViewDialog ({ group, groupViews, onClose }) {
  const { t } = useTranslation()
  const dispatch = useDispatch()
  const [selectedType, setSelectedType] = useState(null)
  const [linkName, setLinkName] = useState('')
  const [linkUrl, setLinkUrl] = useState('')
  const [linkIcon, setLinkIcon] = useState('Globe')
  const [textContent, setTextContent] = useState('')
  const [showCustomViewDialog, setShowCustomViewDialog] = useState(false)
  const [isCreating, setIsCreating] = useState(false)

  const typesInMenu = useMemo(
    () => new Set((groupViews || []).map(view => view.type)),
    [groupViews]
  )

  const isTypeInMenu = useCallback((type) => {
    return SINGLETON_VIEW_TYPES.has(type) && typesInMenu.has(type)
  }, [typesInMenu])

  const resetTypeFields = useCallback(() => {
    setLinkName('')
    setLinkUrl('')
    setLinkIcon('Globe')
    setTextContent('')
  }, [])

  const handleRowClick = useCallback((type) => {
    if (isTypeInMenu(type)) return
    setSelectedType(prev => {
      if (prev === type) {
        resetTypeFields()
        return null
      }
      resetTypeFields()
      return type
    })
  }, [isTypeInMenu, resetTypeFields])

  const canAdd = useMemo(() => {
    if (!selectedType) return false
    if (selectedType === 'link') return Boolean(linkName.trim() && linkUrl.trim())
    if (selectedType === 'text') return Boolean(textContent.trim())
    if (selectedType === 'custom') return true
    return true
  }, [selectedType, linkName, linkUrl, textContent])

  const handleAdd = useCallback(async () => {
    if (!canAdd || !group?.id || !selectedType) return

    if (selectedType === 'custom') {
      setShowCustomViewDialog(true)
      return
    }

    setIsCreating(true)
    try {
      await dispatch(createGroupView({
        groupId: group.id,
        type: selectedType,
        name: selectedType === 'link' ? linkName.trim() : null,
        link: selectedType === 'link' ? linkUrl.trim() : null,
        icon: selectedType === 'link' ? linkIcon : null,
        pageContent: selectedType === 'text' ? textContent.trim() : null,
        addToEnd: true
      }))
      onClose()
    } catch (error) {
      console.error('Failed to create group view:', error)
    } finally {
      setIsCreating(false)
    }
  }, [canAdd, dispatch, group?.id, selectedType, linkName, linkUrl, linkIcon, textContent, onClose])

  const handleCustomViewCreated = useCallback(() => {
    setShowCustomViewDialog(false)
    onClose()
  }, [onClose])

  return (
    <>
      <div className='fixed inset-0 z-50 flex items-center justify-center bg-darkening/50'>
        <div className='bg-midground rounded-lg shadow-lg p-4 w-full max-w-md max-h-[80vh] flex flex-col'>
          <h2 className='text-lg font-semibold mb-4'>{t('Add View')}</h2>

          <div className='flex flex-col gap-1 overflow-y-auto flex-1 min-h-0'>
            {ADDABLE_GROUP_VIEW_TYPES.map(type => {
              const inMenu = isTypeInMenu(type)
              const isSelected = selectedType === type
              const presentedView = GroupViewPresenter({ type })
              const label = displayNameForView({ type }, t)

              return (
                <React.Fragment key={type}>
                  <button
                    type='button'
                    disabled={inMenu}
                    onClick={() => handleRowClick(type)}
                    className={cn(
                      'flex items-center gap-3 w-full px-2 py-1 text-left border-2 rounded-md transition-all',
                      inMenu
                        ? 'border-foreground/10 opacity-60 cursor-not-allowed'
                        : 'border-foreground/20 hover:border-foreground/50 cursor-pointer',
                      isSelected && !inMenu && 'border-selected bg-selected/10'
                    )}
                  >
                    <Checkbox
                      checked={inMenu || isSelected}
                      disabled={inMenu}
                      className='pointer-events-none'
                      aria-hidden
                    />
                    <GroupViewIcon view={presentedView} className='w-4 h-4 shrink-0 text-foreground/70' />
                    <span className='flex-1 text-base text-foreground truncate'>{label}</span>
                    <span className='text-xs text-foreground/50 shrink-0 max-w-[40%] text-right truncate'>
                      {inMenu ? t('Added') : descriptionForViewType(type, t)}
                    </span>
                  </button>

                  {isSelected && type === 'text' && (
                    <div className='ml-9 mr-1 mb-1'>
                      <textarea
                        value={textContent}
                        onChange={e => setTextContent(e.target.value)}
                        placeholder={t('Text to display in the menu')}
                        rows={3}
                        className='w-full rounded-md border border-foreground/20 bg-input p-2 text-sm text-foreground'
                      />
                    </div>
                  )}

                  {isSelected && type === 'link' && (
                    <div className='ml-9 mr-1 mb-1 flex flex-col gap-2'>
                      <div className='flex flex-col gap-1'>
                        <label className='text-sm text-foreground/70'>{t('Icon')}</label>
                        <LucideIconPicker value={linkIcon} onChange={setLinkIcon} />
                      </div>
                      <Input
                        value={linkName}
                        onChange={e => setLinkName(e.target.value)}
                        placeholder={t('Title')}
                      />
                      <Input
                        value={linkUrl}
                        onChange={e => setLinkUrl(e.target.value)}
                        placeholder={t('URL')}
                      />
                    </div>
                  )}
                </React.Fragment>
              )
            })}
          </div>

          <div className='flex justify-end gap-2 mt-4 pt-2 border-t border-foreground/10'>
            <Button variant='secondary' onClick={onClose}>{t('Cancel')}</Button>
            <Button variant='primary' disabled={!canAdd || isCreating} onClick={handleAdd}>
              {isCreating ? t('Creating...') : t('Add View')}
            </Button>
          </div>
        </div>
      </div>

      {showCustomViewDialog && (
        <AddCustomViewDialog
          group={group}
          onCancel={() => setShowCustomViewDialog(false)}
          onCreated={handleCustomViewCreated}
        />
      )}
    </>
  )
}

/** Button row for adding views in edit mode. */
export function AddViewButton ({ onClick }) {
  const { t } = useTranslation()
  return (
    <button
      type='button'
      onClick={onClick}
      className='flex items-center gap-2 w-full text-base text-foreground border-2 border-dashed border-foreground/30 hover:border-foreground/50 rounded-md p-2 pl-2 mb-2 transition-all opacity-85 hover:opacity-100'
    >
      <Plus className='w-4 h-4' />
      <span>{t('Add View')}</span>
    </button>
  )
}
