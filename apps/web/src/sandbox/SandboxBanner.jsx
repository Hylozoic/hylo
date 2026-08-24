import React from 'react'
import { useTranslation } from 'react-i18next'
import Icon from 'components/Icon'
import LocaleDropdown from 'routes/AuthLayoutRouter/components/GlobalNav/LocaleDropdown/LocaleDropdown'
import { getLocaleFromLocalStorage, localeToFlagEmoji, localeToWord } from 'util/locale'

/**
 * Persistent chrome for sandbox mode — makes it obvious the visitor is in a
 * demo, and offers reset + leave-to-signup without threading flags through the app.
 */
export default function SandboxBanner () {
  const { t, i18n } = useTranslation()
  const locale = getLocaleFromLocalStorage(i18n.language)
  const localeFlag = localeToFlagEmoji(locale)
  const localeWord = localeToWord(locale)

  const handleReset = () => {
    window.location.reload()
  }

  return (
    <div
      role='status'
      data-testid='sandbox-banner'
      className='shrink-0 z-[200] flex items-center justify-between gap-3 px-3 py-2 bg-foreground text-background text-sm'
    >
      <p className='min-w-0 flex-1 truncate font-medium'>
        {t("You're exploring a demo. Changes aren't saved.")}
      </p>
      <div className='flex items-center gap-2 shrink-0'>
        <LocaleDropdown
          id='sandbox-locale-dropdown'
          className='rounded-md border border-background/40 px-2.5 py-1 text-sm text-background hover:bg-background/10 transition-colors'
          renderToggleChildren={
            <span className='inline-flex items-center gap-1.5'>
              <span aria-hidden='true'>{localeFlag}</span>
              <span className='hidden sm:inline'>{t(localeWord)}</span>
              <Icon name='ArrowDown' className='text-background' />
            </span>
          }
        />
        <button
          type='button'
          onClick={handleReset}
          className='px-2.5 py-1 rounded-md border border-background/40 hover:bg-background/10 transition-colors'
        >
          {t('Reset demo')}
        </button>
        <a
          href='/signup'
          className='px-2.5 py-1 rounded-md bg-background text-foreground font-semibold hover:opacity-90 transition-opacity'
        >
          {t('Sign up')}
        </a>
      </div>
    </div>
  )
}
