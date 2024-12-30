import React from 'react'
import { useTranslation } from 'react-i18next'
import LocaleDropdown from 'routes/AuthLayoutRouter/components/GlobalNav/LocaleDropdown/LocaleDropdown'
import { localeToFlagEmoji, localeLocalStorageSync } from 'util/locale'

export default function LocaleTab ({ currentUser }) {
  const { t } = useTranslation()
  const locale = currentUser?.settings?.locale
  const localeFlag = localeToFlagEmoji(localeLocalStorageSync(locale))

  return (
    <div className='p-6'>
      <h2>{t('Language Settings')}</h2>
      <p className='my-5 text-gray-600 text-base'>
        {t('Select your preferred language for the Hylo interface')}
      </p>
      <LocaleDropdown renderToggleChildren={<span>{t('Locale')} {localeFlag}</span>} />
    </div>
  )
}
