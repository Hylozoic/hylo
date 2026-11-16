import React, { useCallback, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useDispatch } from 'react-redux'

import Button from 'components/ui/button'
import CustomViewFormFields from 'components/CustomViewForm/CustomViewFormFields'
import {
  DEFAULT_SELECTED_POST_TYPES,
  CUSTOM_VIEW_DEFAULT_VIEW_MODE
} from 'components/CustomViewForm/customViewFormConstants'
import validateCustomViewForm from 'components/CustomViewForm/validateCustomViewForm'
import { createGroupView } from 'store/actions/groupViews'

/** Modal for configuring a new custom GroupView before creation.
 * Pass `onAdd` to stage the view locally instead of dispatching a mutation (see AddGroupViewDialog). */
export default function AddCustomViewDialog ({ group, onCancel, onCreated, onAdd }) {
  const { t } = useTranslation()
  const dispatch = useDispatch()
  const [name, setName] = useState('')
  const [icon, setIcon] = useState('ListFilter')
  const [postTypes, setPostTypes] = useState(DEFAULT_SELECTED_POST_TYPES)
  const [topics, setTopics] = useState([])
  const [searchText, setSearchText] = useState('')
  const [defaultViewMode, setDefaultViewMode] = useState(CUSTOM_VIEW_DEFAULT_VIEW_MODE)
  const [isSaving, setIsSaving] = useState(false)
  const [showErrors, setShowErrors] = useState(false)
  const nameInputRef = useRef(null)

  const errors = useMemo(() => validateCustomViewForm({ name, postTypes }), [name, postTypes])

  // The button stays enabled: a disabled button gave no hint that the Name field
  // (often scrolled out of view above the pills) was what blocked saving (#1731).
  const handleSave = useCallback(async () => {
    if (Object.keys(errors).length > 0) {
      setShowErrors(true)
      if (errors.name) nameInputRef.current?.focus()
      return
    }

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
      addToEnd: true
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
  }, [errors, defaultViewMode, dispatch, group?.id, name, icon, topics, postTypes, searchText, onCreated, onAdd])

  return (
    <div data-hylo-nested-dialog className='fixed inset-0 z-[1100] flex items-center justify-center bg-darkening/50 p-4 pointer-events-auto'>
      <div className='bg-midground rounded-lg shadow-lg p-5 w-full max-w-md max-h-[85vh] flex flex-col'>
        <h2 className='text-lg font-semibold mb-4'>{t('Custom Post Stream')}</h2>

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
            errors={showErrors ? errors : {}}
            nameInputRef={nameInputRef}
          />
        </div>

        <div className='flex justify-end gap-2 mt-4 pt-2 border-t border-foreground/10'>
          <Button variant='primary' onClick={onCancel}>{t('Back')}</Button>
          <Button variant='secondary' disabled={isSaving} onClick={handleSave} data-testid='custom-view-add'>
            {isSaving ? t('Creating...') : t('Add View')}
          </Button>
        </div>
      </div>
    </div>
  )
}
