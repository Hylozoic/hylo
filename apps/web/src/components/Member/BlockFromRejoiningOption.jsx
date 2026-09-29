import React from 'react'
import { useTranslation } from 'react-i18next'

/** The 'Also block from rejoining' checkbox, unticked unless the steward ticks it. */
export default function BlockFromRejoiningOption ({ id, checked, onChange }) {
  const { t } = useTranslation()
  return (
    <div className='flex items-start gap-2 text-sm text-foreground'>
      <input
        id={`block-from-rejoining-${id}`}
        type='checkbox'
        checked={checked}
        onChange={event => onChange(event.target.checked)}
        aria-describedby={`block-from-rejoining-${id}-hint`}
        className='mt-0.5 h-4 w-4 shrink-0 rounded border-foreground/30 cursor-pointer'
        data-testid='block-from-rejoining'
      />
      <div>
        <label htmlFor={`block-from-rejoining-${id}`} className='font-medium cursor-pointer select-none'>
          {t('Also block from rejoining')}
        </label>
        <p id={`block-from-rejoining-${id}-hint`} className='m-0 text-foreground/60'>
          {t("They won't be able to come back through the join link, an invitation or a request until a steward lifts the block.")}
        </p>
      </div>
    </div>
  )
}
