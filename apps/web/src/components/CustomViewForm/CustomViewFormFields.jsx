import React from 'react'
import { useTranslation } from 'react-i18next'

import { Input } from 'components/ui/input'
import LucideIconPicker from 'components/LucideIconPicker/LucideIconPicker'
import PostTypePills from 'components/PostTypePills/PostTypePills'
import TopicSelector from 'components/TopicSelector/TopicSelector'
import DefaultViewModePicker from './DefaultViewModePicker'

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

      <PostTypePills postTypes={postTypes} onPostTypesChange={onPostTypesChange} />

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
