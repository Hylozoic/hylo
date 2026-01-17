import React from 'react'
import { getLocaleFromLocalStorage } from 'util/locale'
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
    if (!currentUser) return getLocaleFromLocalStorage(locale)
    dispatch(updateUserSettings({ settings: { locale } }))
      .then(() => getLocaleFromLocalStorage(locale))
  }

  return (
    <Dropdown
      id='locale-dropdown'
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
        },
        {
          key: 'de',
          label: '🇩🇪 ' + t('German'),
          onClick: () => handleLocaleChange('de')
        },
        {
          key: 'fr',
          label: '🇫🇷 ' + t('French'),
          onClick: () => handleLocaleChange('fr')
        },
        {
          key: 'hi',
          label: '🇮🇳 ' + t('Hindi'),
          onClick: () => handleLocaleChange('it')
        },
        {
          key: 'pt',
          label: '🇵🇹 ' + t('Portuguese'),
          onClick: () => handleLocaleChange('pt')
        }
      ]}
    />
  )
}
