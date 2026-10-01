import React from 'react'
import { useTranslation } from 'react-i18next'
import { cn } from 'util/index'
import { CircleDashed, MessageSquareDashed } from 'lucide-react'

const actionClasses = 'mt-3 border-2 border-foreground/20 rounded-lg px-4 py-2 text-foreground/70 font-medium transition-colors hover:text-foreground hover:border-foreground/40'

const NoPosts = ({ message, className, icon, actionLabel, onAction, secondaryActionLabel, onSecondaryAction }) => {
  const { t } = useTranslation()
  const tMessage = message || t('Nothing to see here')
  return (
    // col-span-full so this centres across the whole stream: the grid view modes
    // make the container a CSS grid, where an unspanned child sits in column one.
    // It is inert in the list and card views.
    <div className={cn('text-center flex flex-col items-center justify-center w-full col-span-full', className)}>
      {icon === 'message-dashed'
        ? <MessageSquareDashed className='w-12 h-12 opacity-50' />
        : <CircleDashed className='w-12 h-12 opacity-50' />}
      <div><h2 className='opacity-70'>{tMessage}</h2></div>
      <div className='flex flex-wrap justify-center gap-x-2'>
        {actionLabel && onAction && (
          <button type='button' onClick={onAction} className={actionClasses}>
            {actionLabel}
          </button>
        )}
        {secondaryActionLabel && onSecondaryAction && (
          <button type='button' onClick={onSecondaryAction} className={actionClasses}>
            {secondaryActionLabel}
          </button>
        )}
      </div>
    </div>
  )
}

export default NoPosts
