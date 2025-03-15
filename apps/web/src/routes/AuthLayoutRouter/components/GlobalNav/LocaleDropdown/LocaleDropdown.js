import React from 'react'
import { localeLocalStorageSync } from 'util/locale'
import { useDispatch, useSelector } from 'react-redux'
import { useTranslation } from 'react-i18next'
import Dropdown from 'components/Dropdown'
import getMe from 'store/selectors/getMe'
import updateUserSettings from 'store/actions/updateUserSettings'

export default function LocaleDropdown ({ renderToggleChildren, className }) {
  const dispatch = useDispatch()
  const { i18n, t } = useTranslation()
  const currentUser = useSelector(getMe)

  const handleLocaleChange = (locale) => {
    i18n.changeLanguage(locale)
    if (!currentUser) return localeLocalStorageSync(locale)
    dispatch(updateUserSettings({ settings: { locale } }))
      .then(() => localeLocalStorageSync(locale))
  }

  return (
    <Dropdown
      className='bg-foreground/20 border-foreground rounded-md p-2 text-sm h-9'
      toggleChildren={renderToggleChildren}
      alignRight
      items={[
        {
          key: 'en',
          label: '🇬🇧 ' + t('English'),
          onClick: () => handleLocaleChange('en')
        },
        {
          key: 'es',
          label: '🇪🇸 ' + t('Spanish'),
          onClick: () => handleLocaleChange('es')
        }
      ]}
    />
  )
}
