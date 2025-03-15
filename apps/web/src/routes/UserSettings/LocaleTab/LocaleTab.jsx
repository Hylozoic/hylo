import React, { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useViewHeader } from 'contexts/ViewHeaderContext'
import LocaleDropdown from 'routes/AuthLayoutRouter/components/GlobalNav/LocaleDropdown/LocaleDropdown'
import { localeToFlagEmoji, localeLocalStorageSync, localeToWord } from 'util/locale'

export default function LocaleTab ({ currentUser }) {
  const { t } = useTranslation()
  const locale = currentUser?.settings?.locale
  const localeFlag = localeToFlagEmoji(localeLocalStorageSync(locale))
  const localeWord = localeToWord(localeLocalStorageSync(locale))

  const { setHeaderDetails } = useViewHeader()
  useEffect(() => {
    setHeaderDetails({
      title: t('Language Settings'),
      icon: '',
      info: '',
      search: true
    })
  }, [setHeaderDetails, locale])

  return (
    <div className='p-3'>
      <p className='my-5 text-gray-600 text-base'>
        {t('Select your preferred language for the Hylo interface')}
      </p>
      <LocaleDropdown renderToggleChildren={<span>{localeFlag} {t(localeWord)}</span>} />
    </div>
  )
}
