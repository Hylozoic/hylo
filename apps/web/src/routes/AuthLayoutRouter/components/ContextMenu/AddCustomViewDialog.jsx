import React, { useCallback, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useDispatch } from 'react-redux'

import Button from 'components/ui/button'
import CustomViewFormFields from 'components/CustomViewForm/CustomViewFormFields'
import {
  CUSTOM_VIEW_DEFAULT_POST_TYPES,
  CUSTOM_VIEW_DEFAULT_VIEW_MODE
} from 'components/CustomViewForm/customViewFormConstants'
import { createGroupView } from 'store/actions/groupViews'

/** Modal for configuring a new custom GroupView before creation.
 * Pass `onAdd` to stage the view locally instead of dispatching a mutation (see AddGroupViewDialog). */
export default function AddCustomViewDialog ({ group, onCancel, onCreated, onAdd, addToMenu = true }) {
  const { t } = useTranslation()
  const dispatch = useDispatch()
  const [name, setName] = useState('')
  const [icon, setIcon] = useState('ListFilter')
  const [postTypes, setPostTypes] = useState(CUSTOM_VIEW_DEFAULT_POST_TYPES)
  const [topics, setTopics] = useState([])
  const [searchText, setSearchText] = useState('')
  const [defaultViewMode, setDefaultViewMode] = useState(CUSTOM_VIEW_DEFAULT_VIEW_MODE)
  const [isSaving, setIsSaving] = useState(false)

  const canSave = name.trim().length >= 2 && postTypes.length > 0

  const handleSave = useCallback(async () => {
    if (!canSave) return

    const viewData = {
      type: 'custom',
      name: name.trim(),
      icon,
      topics: topics.map(topic => topic.name),
      settings: {
        postTypes,
        activePostsOnly: false,
        defaultSort: 'created',
        defaultViewMode,
        searchText: searchText.trim() || undefined
      },
      ...(addToMenu ? { addToEnd: true } : { hidden: true })
    }

    if (onAdd) {
      onAdd(viewData)
      return
    }

    if (!group?.id) return
    setIsSaving(true)
    try {
      await dispatch(createGroupView({ groupId: group.id, ...viewData }))
      onCreated()
    } catch (error) {
      console.error('Failed to create custom view:', error)
    } finally {
      setIsSaving(false)
    }
  }, [addToMenu, canSave, defaultViewMode, dispatch, group?.id, name, icon, topics, postTypes, searchText, onCreated, onAdd])

  return (
    <div className='fixed inset-0 z-[60] flex items-center justify-center bg-darkening/50 p-4'>
      <div className='bg-midground rounded-lg shadow-lg p-5 w-full max-w-md max-h-[85vh] flex flex-col'>
        <h2 className='text-lg font-semibold mb-4'>{t('Custom View')}</h2>

        <div className='overflow-y-auto flex-1 min-h-0 p-1'>
          <CustomViewFormFields
            group={group}
            name={name}
            onNameChange={setName}
            icon={icon}
            onIconChange={setIcon}
            postTypes={postTypes}
            onPostTypesChange={setPostTypes}
            topics={topics}
            onTopicsChange={setTopics}
            searchText={searchText}
            onSearchTextChange={setSearchText}
            defaultViewMode={defaultViewMode}
            onDefaultViewModeChange={setDefaultViewMode}
          />
        </div>

        <div className='flex justify-end gap-2 mt-4 pt-2 border-t border-foreground/10'>
          <Button variant='primary' onClick={onCancel}>{t('Back')}</Button>
          <Button variant='secondary' disabled={!canSave || isSaving} onClick={handleSave}>
            {isSaving ? t('Creating...') : t('Add View')}
          </Button>
        </div>
      </div>
    </div>
  )
}
