import React from 'react'
import { useTranslation } from 'react-i18next'

export default function WelcomeWizardModalFooter ({ previous, submit, continueText, showPrevious = true }) {
  const { t } = useTranslation()
  return (
    <div>
      <div className='pt-5'>
        <div className='mb-5 text-center relative flex justify-center items-center gap-2'>
          {showPrevious && (
            <button
              className='border-2 border-foreground/20 hover:border-foreground/100 scale-100 hover:scale-105 rounded-lg p-2 hover:bg-background transition-colors'
              onClick={previous}
            >
              {t('Back')}
            </button>
          )}
          <button
            id='continue-button'
            className='border-2 border-selected/20 hover:border-selected/100 scale-100 hover:scale-105 text-foreground p-2 rounded-lg text-base hover:bg-primary/90 transition-all hover:-translate-y-0.5 hover:shadow-lg'
            onClick={submit}
          >
            {continueText}
          </button>
        </div>
      </div>
    </div>
  )
}
