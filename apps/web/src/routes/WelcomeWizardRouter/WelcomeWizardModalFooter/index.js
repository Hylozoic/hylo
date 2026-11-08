import React, { useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { cn } from 'util/index'

export default function WelcomeWizardModalFooter ({ previous, submit, continueText, showPrevious = true, continueReady = false }) {
  const { t } = useTranslation()
  const pressLock = useRef(false)

  // A focused location field blurs on the first tap and Android drops the click
  // (and may scroll the dialog). Run the action on pointerdown and ignore the
  // click that follows the same tap. Keyboard activation only fires click.
  const press = (action) => (event) => {
    if (event.button != null && event.button !== 0) return
    if (pressLock.current) return
    pressLock.current = true
    event.preventDefault()
    action()
    setTimeout(() => { pressLock.current = false }, 0)
  }

  return (
    <div>
      <div className='pt-5'>
        <div className='relative z-20 flex justify-between items-center gap-2'>
          {showPrevious
            ? (
              <button
                type='button'
                className='border-2 border-foreground/20 hover:border-foreground/50 scale-100 hover:scale-105 rounded-lg p-2 hover:bg-background transition-colors'
                onPointerDown={press(previous)}
                onClick={press(previous)}
              >
                {t('Back')}
              </button>
              )
            : <span />}
          <button
            id='continue-button'
            type='button'
            className={cn(
              'scale-100 hover:scale-105 text-foreground p-2 rounded-lg text-base transition-all hover:-translate-y-0.5 hover:shadow-lg border-2',
              continueReady
                ? 'bg-selected border-selected hover:bg-selected/90'
                : 'border-selected/20 hover:border-selected/100 hover:bg-primary/90'
            )}
            onPointerDown={press(submit)}
            onClick={press(submit)}
          >
            {continueText}
          </button>
        </div>
      </div>
    </div>
  )
}
