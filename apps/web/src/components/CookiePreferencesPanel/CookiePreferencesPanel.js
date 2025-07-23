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
      'left-0 right-0 bottom-0 w-full rounded-none border-t-2 border-l-0 border-r-0 border-b-0 p-1',
      'sm:right-6 sm:bottom-6 sm:w-[350px] sm:max-w-full sm:rounded-lg sm:border-2 sm:p-2 sm:left-auto sm:border-t-2 sm:border-l-2 sm:border-r-2 sm:border-b-2'
    )}
    >
      <div className={cn('flex flex-col gap-y-2 w-full')}>
        {/* Header and description */}
        <div className={cn('text-center sm:text-left')}>
          <h2 className={cn('text-lg font-bold mb-1')}>{t('Cookie Preferences')}</h2>
          <h3 className={cn('text-xs font-semibold mt-2 text-muted-foreground')}>{t('Essential cookies')}</h3>
          <p className={cn('text-sm text-muted-foreground')}>{t('We use cookies to help understand whether you are logged in and to understand your preferences and where you are in Hylo.')}</p>
        </div>

        {/* Buttons */}
        <div className={cn('flex flex-col gap-2 w-full items-center')}>
          <Button
            size='sm'
            onClick={handleRejectNonEssential}
            className='w-full max-w-xs mx-auto justify-center'
          >
            {t('Reject Non-Essential')}
          </Button>
          <Button
            variant='outline'
            size='sm'
            onClick={handleSave}
            className='w-full max-w-xs mx-auto justify-center'
          >
            {t('Save Preferences')}
          </Button>
        </div>

        {/* Switches */}
        <div className={cn('grid grid-cols-1 gap-y-4 sm:grid-cols-2 sm:gap-x-6 border-t border-border pt-2')}>
          {/* Analytics Switch */}
          <div className={cn('flex flex-col items-center gap-1 md:flex-row md:items-center')}>
            <Switch
              checked={preferences.analytics}
              onCheckedChange={(checked) => setPreferences(prev => ({ ...prev, analytics: checked }))}
            />
            <div className={cn('flex-1 text-center md:text-left')}>
              <div className={cn('flex items-center justify-center gap-2 md:justify-start flex-row')}>
                <h3 className={cn('font-medium text-sm')}>{t('Analytics (Mixpanel)')}</h3>
                <button
                  onClick={() => setShowInfo(!showInfo)}
                  className={cn('text-muted-foreground hover:text-foreground transition-colors')}
                >
                  <svg className={cn('w-4 h-4')} fill='none' stroke='currentColor' viewBox='0 0 24 24'>
                    <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z' />
                  </svg>
                </button>
              </div>
              {showInfo && (
                <p className={cn('text-xs text-muted-foreground mt-1')}>{t('We use a service called Mixpanel to understand how people like you use Hylo. Your identity is anonymized but your behavior is recorded so that we can make improvements to Hylo based on how people are using it.')}</p>
              )}
            </div>
          </div>

          {/* Support Switch */}
          <div className={cn('flex flex-col items-center gap-1 md:flex-row md:items-center')}>
            <Switch
              checked={preferences.support}
              onCheckedChange={(checked) => setPreferences(prev => ({ ...prev, support: checked }))}
            />
            <div className={cn('flex-1 text-center md:text-left')}>
              <div className={cn('flex items-center justify-center gap-2 md:justify-start flex-row')}>
                <h3 className={cn('font-medium text-sm')}>{t('Support (Intercom)')}</h3>
                <button
                  onClick={() => setShowInfo(!showInfo)}
                  className={cn('text-muted-foreground hover:text-foreground transition-colors')}
                >
                  <svg className={cn('w-4 h-4')} fill='none' stroke='currentColor' viewBox='0 0 24 24'>
                    <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z' />
                  </svg>
                </button>
              </div>
              {showInfo && (
                <p className={cn('text-xs text-muted-foreground mt-1')}>{t('When people on Hylo need help or want to report a bug, they are interacting with a service called Intercom. Intercom stores cookies in your browser to keep track of conversations with us, the development team.')}</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
