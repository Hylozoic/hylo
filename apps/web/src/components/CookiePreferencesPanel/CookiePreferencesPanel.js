import React, { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useCookieConsent } from 'contexts/CookieConsentContext'
import Button from 'components/ui/button'
import { Switch } from 'components/ui/switch'
import { cn } from 'util/index'
import { getCookieConsent } from 'util/cookieConsent'

export default function CookiePreferencesPanel () {
  const { t } = useTranslation()
  const { showPreferencesPanel, hidePreferences, updateCookieConsent } = useCookieConsent()
  const [preferences, setPreferences] = useState({
    analytics: true,
    support: true
  })
  const [showInfo, setShowInfo] = useState(false)

  // Sync preferences with cookie when panel is opened
  useEffect(() => {
    if (showPreferencesPanel) {
      const cookie = getCookieConsent()
      if (cookie) {
        setPreferences({
          analytics: cookie.analytics,
          support: cookie.support
        })
      }
    }
  }, [showPreferencesPanel])

  const handleSave = async () => {
    const success = await updateCookieConsent(preferences)
    if (success) {
      hidePreferences()
    }
  }

  const handleRejectNonEssential = async () => {
    const success = await updateCookieConsent({
      analytics: false,
      support: false
    })
    if (success) {
      hidePreferences()
    }
  }

  if (!showPreferencesPanel) {
    return null
  }

  return (
    <div className={cn(
      'fixed z-[1000] bg-background border-foreground/20 shadow-lg',
      'left-0 right-0 bottom-0 w-full rounded-none border-t-2 border-l-0 border-r-0 border-b-0 p-1 pl-2 pr-2',
      'sm:right-6 sm:bottom-6 sm:w-[350px] sm:max-w-full sm:rounded-lg sm:border-2 sm:p-2 sm:left-auto sm:border-t-2 sm:border-l-2 sm:border-r-2 sm:border-b-2'
    )}
    >
      <div className={cn('flex flex-col gap-y-2 w-full')}>
        {/* Header and description */}
        <div className={cn('text-left')}>
          <h2 className={cn('text-sm font-bold mb-1')}>{t('Cookie Preferences')}</h2>
          <p className={cn('text-sm text-muted-foreground')}>{t('We use essential cookies to help understand whether you are logged in and to understand your preferences and where you are in Hylo.')}</p>
        </div>

        {/* Switches */}
        <div className={cn('grid grid-cols-2 gap-x-4 pt-0 pb-4 items-center')}>
          {/* Analytics Switch */}
          <div className={cn('flex items-center justify-center gap-2')}>
            <Switch
              checked={preferences.analytics}
              onCheckedChange={(checked) => setPreferences(prev => ({ ...prev, analytics: checked }))}
            />
            <h3 className={cn('font-medium text-sm m-0 leading-tight')}>
              <span>{t('Analytics')}</span>
              <span className={cn('hidden sm:inline')}> ({t('Mixpanel')})</span>
            </h3>
            <button
              onClick={() => setShowInfo(!showInfo)}
              className={cn('text-muted-foreground hover:text-foreground transition-colors flex-shrink-0')}
            >
              <svg className={cn('w-4 h-4')} fill='none' stroke='currentColor' viewBox='0 0 24 24'>
                <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z' />
              </svg>
            </button>
          </div>

          {/* Support Switch */}
          <div className={cn('flex items-center justify-center gap-2')}>
            <Switch
              checked={preferences.support}
              onCheckedChange={(checked) => setPreferences(prev => ({ ...prev, support: checked }))}
            />
            <h3 className={cn('font-medium text-sm m-0 leading-tight')}>
              <span>{t('Support')}</span>
              <span className={cn('hidden sm:inline')}> ({t('Intercom')})</span>
            </h3>
            <button
              onClick={() => setShowInfo(!showInfo)}
              className={cn('text-muted-foreground hover:text-foreground transition-colors flex-shrink-0')}
            >
              <svg className={cn('w-4 h-4')} fill='none' stroke='currentColor' viewBox='0 0 24 24'>
                <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z' />
              </svg>
            </button>
          </div>
        </div>
        {showInfo && (
          <div className={cn('grid grid-cols-2 gap-x-4')}>
            <p className={cn('text-xs text-muted-foreground')}>{t('We use a service called Mixpanel to understand how people like you use Hylo. Your identity is anonymized but your behavior is recorded so that we can make improvements to Hylo based on how people are using it.')}</p>
            <p className={cn('text-xs text-muted-foreground')}>{t('When people on Hylo need help or want to report a bug, they are interacting with a service called Intercom. Intercom stores cookies in your browser to keep track of conversations with us, the development team.')}</p>
          </div>
        )}
        {/* Buttons */}
        <div className={cn('flex gap-2 w-full items-center')}>
          <Button
            size='sm'
            onClick={handleRejectNonEssential}
            className='w-full max-w-xs mx-auto justify-center'
          >
            {t('Reject Non-Essential')}
          </Button>
          <Button
            size='sm'
            onClick={handleSave}
            className='w-full max-w-xs mx-auto justify-center px-1 bg-foreground border-none text-background'
          >
            {t('Save and Continue')}
          </Button>
        </div>
      </div>
    </div>
  )
}
