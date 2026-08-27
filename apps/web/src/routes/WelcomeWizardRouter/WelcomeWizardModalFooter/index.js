import React from 'react'
import { useTranslation } from 'react-i18next'
import { cn } from 'util/index'

export default function WelcomeWizardModalFooter ({ previous, submit, continueText, showPrevious = true, continueReady = false }) {
  const { t } = useTranslation()
  return (
    <div>
      <div className='pt-5'>
        <div className='relative flex justify-between items-center gap-2'>
          {showPrevious
            ? (
              <button
                className='border-2 border-foreground/20 hover:border-foreground/50 scale-100 hover:scale-105 rounded-lg p-2 hover:bg-background transition-colors'
                onClick={previous}
              >
                {t('Back')}
              </button>
              )
            : <span />}
          <button
            id='continue-button'
            className={cn(
              'scale-100 hover:scale-105 text-foreground p-2 rounded-lg text-base transition-all hover:-translate-y-0.5 hover:shadow-lg border-2',
              continueReady
                ? 'bg-selected border-selected hover:bg-selected/90'
                : 'border-selected/20 hover:border-selected/100 hover:bg-primary/90'
            )}
            onClick={submit}
          >
            {continueText}
          </button>
        </div>
      </div>
    </div>
  )
}
