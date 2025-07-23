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

  const handleAcceptAll = async () => {
    const success = await updateCookieConsent({
      analytics: true,
      support: true
    })
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
    <div className={cn('fixed bottom-0 left-0 right-0 bg-background border-t-2 border-foreground/20 z-[1000] p-3 pr-5 pl-5 shadow-lg')}>
      <div className={cn('max-w-none mx-auto')}>
        <div className={cn('flex flex-col items-center md:flex-row md:items-center gap-3')}>
          <div className={cn('flex-1 text-center md:text-left')}>
            <h2 className={cn('text-lg font-bold mb-1')}>
              {t('Cookie Preferences')}
            </h2>
            <p className={cn('text-sm text-muted-foreground')}>
              {t('We use cookies to help understand whether you are logged in and to understand your preferences and where you are in Hylo.')}
            </p>
          </div>

          <div className={cn('flex flex-col items-center sm:flex-row gap-2 min-w-fit')}>
            <Button
              variant='outline'
              size='sm'
              onClick={handleRejectNonEssential}
            >
              {t('Reject Non-Essential')}
            </Button>

            <Button
              variant='outline'
              size='sm'
              onClick={handleAcceptAll}
            >
              {t('Consent to All')}
            </Button>

            <Button
              size='sm'
              onClick={handleSave}
            >
              {t('Save Preferences')}
            </Button>
          </div>
        </div>

        <div className={cn('border-t border-border mt-3 md:mt-0')}>
          <div className={cn('grid grid-cols-1 gap-2 md:grid-cols-2 md:gap-6')}>
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
                  <p className={cn('text-xs text-muted-foreground mt-1')}>
                    {t('We use a service called Mixpanel to understand how people like you use Hylo. Your identity is anonymized but your behavior is recorded so that we can make improvements to Hylo based on how people are using it.')}
                  </p>
                )}
              </div>
            </div>

            <div className={cn('flex flex-col items-center gap-3 md:flex-row md:items-center')}>
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
                  <p className={cn('text-xs text-muted-foreground mt-1')}>
                    {t('When people on Hylo need help or want to report a bug, they are interacting with a service called Intercom. Intercom stores cookies in your browser to keep track of conversations with us, the development team.')}
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
