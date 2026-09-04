import React, { useCallback, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { ArrowLeftRight, BookOpen, Calendar, Check, FolderKanban, MessageSquareText, Vote } from 'lucide-react'

import { CUSTOM_VIEW_POST_TYPE_OPTIONS } from 'components/CustomViewForm/customViewFormConstants'
import { cn } from 'util/index'

/** Per-post-type icon and selected-state color (literal class names so Tailwind's scanner picks them up). */
const POST_TYPE_OPTION_STYLES = {
  discussion: { icon: MessageSquareText, selectedClassName: 'border-discussions bg-discussions/15 text-discussions' },
  event: { icon: Calendar, selectedClassName: 'border-events bg-events/15 text-events' },
  'requests-and-offers': { icon: ArrowLeftRight, selectedClassName: 'border-requests bg-requests/15 text-requests' },
  resource: { icon: BookOpen, selectedClassName: 'border-resources bg-resources/15 text-resources' },
  proposal: { icon: Vote, selectedClassName: 'border-proposals bg-proposals/15 text-proposals' },
  project: { icon: FolderKanban, selectedClassName: 'border-projects bg-projects/15 text-projects' }
}

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
          const { icon: OptionIcon, selectedClassName } = POST_TYPE_OPTION_STYLES[option.key]

          return (
            <button
              key={option.key}
              type='button'
              aria-pressed={isSelected}
              onClick={() => togglePostTypeOption(option)}
              className={cn(
                'inline-flex items-center gap-2 rounded-full border-2 px-3 py-1 text-sm font-medium transition-colors',
                isSelected
                  ? cn('border-solid', selectedClassName)
                  : 'border-dashed border-foreground/30 text-foreground/70 hover:border-foreground/50'
              )}
            >
              <span
                className='flex h-4 w-4 shrink-0 items-center justify-center rounded-sm border border-current'
                aria-hidden
              >
                {isSelected && <Check className='h-4 w-4' strokeWidth={3} />}
              </span>
              <OptionIcon className='w-4 h-4 shrink-0' />
              <span>{optionLabel}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
