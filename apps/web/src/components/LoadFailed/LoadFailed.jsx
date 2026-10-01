import React from 'react'
import { useTranslation } from 'react-i18next'
import { CloudOff } from 'lucide-react'
import { cn } from 'util/index'

/**
 * Shown instead of "not found" when a page's data could not be loaded because
 * the network dropped or the server had a problem: the thing may well exist,
 * so offer to try again.
 */
export default function LoadFailed ({ onRetry, className }) {
  const { t } = useTranslation()
  return (
    <div
      role='alert'
      className={cn('flex flex-col items-center justify-center text-center gap-3 p-8 min-h-[300px] text-foreground', className)}
      data-testid='load-failed'
    >
      <CloudOff className='w-12 h-12 opacity-50' aria-hidden='true' />
      <h2 className='text-xl font-bold m-0'>{t('Couldn\'t load this')}</h2>
      <p className='text-foreground/70 m-0'>{t('Check your connection, then try again.')}</p>
      {onRetry && (
        <button
          type='button'
          onClick={onRetry}
          className='mt-2 border-2 border-foreground/20 rounded-lg px-4 py-2 text-foreground/80 font-medium transition-colors hover:text-foreground hover:border-foreground/40'
        >
          {t('Try Again')}
        </button>
      )}
    </div>
  )
}
