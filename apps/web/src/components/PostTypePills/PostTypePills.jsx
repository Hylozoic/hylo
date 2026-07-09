import React, { useCallback, useMemo } from 'react'
import { useTranslation } from 'react-i18next'

import PostLabel from 'components/PostLabel'
import { CUSTOM_VIEW_POST_TYPE_OPTIONS } from 'components/CustomViewForm/customViewFormConstants'
import { cn } from 'util/index'

/** Toggleable pills for selecting which post types apply (custom views, spaces, etc). */
export default function PostTypePills ({ postTypes, onPostTypesChange, label }) {
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
    <div className='flex flex-col gap-2'>
      <label className='text-sm text-foreground/70'>{label || t('What post types to display?')}</label>
      <div className='flex flex-wrap gap-2'>
        {CUSTOM_VIEW_POST_TYPE_OPTIONS.map(option => {
          const isSelected = selectedOptionKeys.includes(option.key)
          const optionLabel = t(option.labelKey)

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
              <span>{optionLabel}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
