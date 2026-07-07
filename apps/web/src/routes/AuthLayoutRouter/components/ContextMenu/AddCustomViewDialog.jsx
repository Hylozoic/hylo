import React, { useCallback, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useDispatch } from 'react-redux'

import Button from 'components/ui/button'
import { Input } from 'components/ui/input'
import LucideIconPicker from 'components/LucideIconPicker/LucideIconPicker'
import PostLabel from 'components/PostLabel'
import TopicSelector from 'components/TopicSelector/TopicSelector'
import { createGroupView } from 'store/actions/groupViews'
import { cn } from 'util/index'

/** All post types available for custom view filters (requests & offers are one pill). */
const CUSTOM_VIEW_DEFAULT_POST_TYPES = [
  'discussion',
  'event',
  'resource',
  'project',
  'proposal',
  'request',
  'offer'
]

const CUSTOM_VIEW_POST_TYPE_OPTIONS = [
  { key: 'discussion', postTypes: ['discussion'], labelKey: 'view-discussions' },
  { key: 'event', postTypes: ['event'], labelKey: 'view-events' },
  { key: 'resource', postTypes: ['resource'], labelKey: 'view-resources' },
  { key: 'project', postTypes: ['project'], labelKey: 'view-projects' },
  { key: 'proposal', postTypes: ['proposal'], labelKey: 'view-proposals' },
  { key: 'requests-and-offers', postTypes: ['request', 'offer'], labelKey: 'view-requests-and-offers' }
]

/** Modal for configuring a new custom GroupView before creation. */
export default function AddCustomViewDialog ({ group, onCancel, onCreated }) {
  const { t } = useTranslation()
  const dispatch = useDispatch()
  const [name, setName] = useState('')
  const [icon, setIcon] = useState('ListFilter')
  const [postTypes, setPostTypes] = useState(CUSTOM_VIEW_DEFAULT_POST_TYPES)
  const [topics, setTopics] = useState([])
  const [searchText, setSearchText] = useState('')
  const [isSaving, setIsSaving] = useState(false)

  const selectedOptionKeys = useMemo(() => {
    return CUSTOM_VIEW_POST_TYPE_OPTIONS
      .filter(option => option.postTypes.every(type => postTypes.includes(type)))
      .map(option => option.key)
  }, [postTypes])

  const togglePostTypeOption = useCallback((option) => {
    const isSelected = option.postTypes.every(type => postTypes.includes(type))
    if (isSelected) {
      setPostTypes(prev => prev.filter(type => !option.postTypes.includes(type)))
      return
    }
    setPostTypes(prev => [...new Set([...prev, ...option.postTypes])])
  }, [postTypes])

  const canSave = name.trim().length >= 2 && postTypes.length > 0

  const handleSave = useCallback(async () => {
    if (!canSave || !group?.id) return
    setIsSaving(true)
    try {
      await dispatch(createGroupView({
        groupId: group.id,
        type: 'custom',
        name: name.trim(),
        icon,
        topics: topics.map(topic => topic.name),
        settings: {
          postTypes,
          activePostsOnly: false,
          defaultSort: 'created',
          defaultViewMode: 'cards',
          searchText: searchText.trim() || undefined
        },
        addToEnd: true
      }))
      onCreated()
    } catch (error) {
      console.error('Failed to create custom view:', error)
    } finally {
      setIsSaving(false)
    }
  }, [canSave, dispatch, group?.id, name, icon, topics, postTypes, searchText, onCreated])

  return (
    <div className='fixed inset-0 z-[60] flex items-center justify-center bg-darkening/50'>
      <div className='bg-midground rounded-lg shadow-lg p-4 w-full max-w-md max-h-[85vh] flex flex-col'>
        <h2 className='text-lg font-semibold mb-4'>{t('Custom View')}</h2>

        <div className='flex flex-col gap-3 overflow-y-auto flex-1 min-h-0'>
          <div className='flex flex-col gap-1'>
            <label className='text-sm text-foreground/70'>{t('Name')}</label>
            <Input value={name} onChange={e => setName(e.target.value)} placeholder={t('Name')} />
          </div>

          <div className='flex flex-col gap-1'>
            <label className='text-sm text-foreground/70'>{t('Icon')}</label>
            <LucideIconPicker value={icon} onChange={setIcon} />
          </div>

          <div className='flex flex-col gap-2'>
            <label className='text-sm text-foreground/70'>{t('What post types to display?')}</label>
            <div className='flex flex-wrap gap-2'>
              {CUSTOM_VIEW_POST_TYPE_OPTIONS.map(option => {
                const isSelected = selectedOptionKeys.includes(option.key)
                const label = t(option.labelKey)

                return (
                  <button
                    key={option.key}
                    type='button'
                    onClick={() => togglePostTypeOption(option)}
                    className={cn(
                      'inline-flex items-center gap-1 rounded-full border px-3 py-1 text-sm transition-colors',
                      isSelected
                        ? 'border-selected bg-selected/20 text-foreground'
                        : 'border-foreground/20 text-foreground/70 hover:border-foreground/40'
                    )}
                  >
                    {option.postTypes.length === 1 && (
                      <PostLabel type={option.postTypes[0]} className='align-middle' />
                    )}
                    <span>{label}</span>
                  </button>
                )
              })}
            </div>
          </div>

          <div className='flex flex-col gap-1'>
            <label className='text-sm text-foreground/70'>{t('Topics')}</label>
            <TopicSelector forGroups={[group]} selectedTopics={topics} onChange={setTopics} />
          </div>

          <div className='flex flex-col gap-1'>
            <label className='text-sm text-foreground/70'>{t('Search term')}</label>
            <Input
              value={searchText}
              onChange={e => setSearchText(e.target.value)}
              placeholder={t('Filter posts by search term (optional)')}
            />
          </div>
        </div>

        <div className='flex justify-end gap-2 mt-4 pt-2 border-t border-foreground/10'>
          <Button variant='secondary' onClick={onCancel}>{t('Cancel')}</Button>
          <Button variant='primary' disabled={!canSave || isSaving} onClick={handleSave}>
            {isSaving ? t('Creating...') : t('Save')}
          </Button>
        </div>
      </div>
    </div>
  )
}
