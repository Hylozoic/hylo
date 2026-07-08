import React, { useCallback, useMemo } from 'react'
import { useTranslation } from 'react-i18next'

import { Input } from 'components/ui/input'
import LucideIconPicker from 'components/LucideIconPicker/LucideIconPicker'
import PostLabel from 'components/PostLabel'
import TopicSelector from 'components/TopicSelector/TopicSelector'
import DefaultViewModePicker from './DefaultViewModePicker'
import {
  CUSTOM_VIEW_POST_TYPE_OPTIONS
} from './customViewFormConstants'
import { cn } from 'util/index'

/** Shared form fields for creating or editing a custom GroupView. */
export default function CustomViewFormFields ({
  group,
  name,
  onNameChange,
  icon,
  onIconChange,
  postTypes,
  onPostTypesChange,
  topics,
  onTopicsChange,
  searchText,
  onSearchTextChange,
  defaultViewMode,
  onDefaultViewModeChange
}) {
  const { t } = useTranslation()

  const selectedOptionKeys = useMemo(() => {
    return CUSTOM_VIEW_POST_TYPE_OPTIONS
      .filter(option => option.postTypes.every(type => postTypes.includes(type)))
      .map(option => option.key)
  }, [postTypes])

  const togglePostTypeOption = useCallback((option) => {
    const isSelected = option.postTypes.every(type => postTypes.includes(type))
    if (isSelected) {
      onPostTypesChange(postTypes.filter(type => !option.postTypes.includes(type)))
      return
    }
    onPostTypesChange([...new Set([...postTypes, ...option.postTypes])])
  }, [onPostTypesChange, postTypes])

  return (
    <div className='flex flex-col gap-3'>
      <div className='flex flex-col gap-1'>
        <label className='text-sm text-foreground/70'>{t('Name')}</label>
        <Input value={name} onChange={e => onNameChange(e.target.value)} placeholder={t('Name')} />
      </div>

      <div className='flex flex-col gap-1'>
        <label className='text-sm text-foreground/70'>{t('Icon')}</label>
        <LucideIconPicker value={icon} onChange={onIconChange} />
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
        <TopicSelector forGroups={[group]} selectedTopics={topics} onChange={onTopicsChange} />
      </div>

      <div className='flex flex-col gap-1'>
        <label className='text-sm text-foreground/70'>{t('Search term')}</label>
        <Input
          value={searchText}
          onChange={e => onSearchTextChange(e.target.value)}
          placeholder={t('Filter posts by search term (optional)')}
        />
      </div>

      <div className='flex flex-col gap-2'>
        <label className='text-sm text-foreground/70'>{t('Default View Mode')}</label>
        <DefaultViewModePicker value={defaultViewMode} onChange={onDefaultViewModeChange} />
      </div>
    </div>
  )
}
