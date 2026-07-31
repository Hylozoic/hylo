import React from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import { Layers, LayoutGrid } from 'lucide-react'

/**
 * Asks whether the thing being added is a view or a space, so the two live
 * behind one Add affordance instead of competing side by side. Each option
 * explains what it is, since the distinction is the part people get wrong.
 */
export default function AddChooserDialog ({ onChooseView, onChooseSpace, onClose, canAddSpace = true }) {
  const { t } = useTranslation()

  const options = [
    {
      key: 'view',
      Icon: LayoutGrid,
      title: t('Add View'),
      description: t('A view is a lens on your group\'s content — a stream of posts, a filtered list, a link, or another way of surfacing what you want members to see.'),
      onChoose: onChooseView
    },
    canAddSpace && {
      key: 'space',
      Icon: Layers,
      title: t('Add Space'),
      description: t('A space is a part of your group with its own members and content — a working group, a cohort, a resource library, or anywhere that membership and focus matter.'),
      onChoose: onChooseSpace
    }
  ].filter(Boolean)

  return createPortal(
    <div
      className='fixed inset-0 z-50 flex items-center justify-center bg-darkening/50 p-4'
      onClick={onClose}
      role='presentation'
    >
      <div
        className='bg-midground rounded-lg shadow-lg p-4 w-full max-w-md flex flex-col gap-3'
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className='text-lg font-semibold m-0'>{t('Add')}</h2>

        <div className='flex flex-col gap-2'>
          {options.map(({ key, Icon, title, description, onChoose }) => (
            <button
              key={key}
              type='button'
              onClick={onChoose}
              className='flex items-start gap-3 text-left rounded-md border-2 border-foreground/10 hover:border-foreground/40 hover:bg-card p-3 transition-all'
            >
              <Icon className='w-5 h-5 shrink-0 mt-0.5 text-foreground/70' />
              <span className='flex flex-col gap-1 min-w-0'>
                <span className='text-base font-semibold text-foreground'>{title}</span>
                <span className='text-sm text-foreground/70 leading-snug'>{description}</span>
              </span>
            </button>
          ))}
        </div>

        <button
          type='button'
          onClick={onClose}
          className='self-end text-sm text-foreground/60 hover:text-foreground transition-colors px-2 py-1'
        >
          {t('Cancel')}
        </button>
      </div>
    </div>,
    document.body
  )
}
