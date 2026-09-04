import React from 'react'
import {
  LOCALE_DE,
  LOCALE_EN_GB,
  LOCALE_EN_US,
  LOCALE_ES,
  LOCALE_FR,
  LOCALE_HI,
  LOCALE_PT,
  normalizeLocaleToFull
} from '@hylo/shared'
import { getLocaleFromLocalStorage } from 'util/locale'
import { useDispatch, useSelector } from 'react-redux'
import { useTranslation } from 'react-i18next'
import Dropdown from 'components/Dropdown'
import getMe from 'store/selectors/getMe'
import updateUserSettings from 'store/actions/updateUserSettings'

export default function LocaleDropdown ({ renderToggleChildren, className, id = 'locale-dropdown' }) {
  const dispatch = useDispatch()
  const { i18n, t } = useTranslation()
  const currentUser = useSelector(getMe)

  const handleLocaleChange = (locale) => {
    const normalizedLocale = normalizeLocaleToFull(locale)
    i18n.changeLanguage(normalizedLocale)
    if (!currentUser) return getLocaleFromLocalStorage(normalizedLocale)
    dispatch(updateUserSettings({ settings: { locale: normalizedLocale } }))
      .then(() => getLocaleFromLocalStorage(normalizedLocale))
  }

  return (
    <Dropdown
      id={id}
      className={className || 'bg-foreground/20 border-foreground rounded-md p-2 text-sm h-9'}
      toggleChildren={renderToggleChildren}
      alignRight
      items={[
        {
          key: LOCALE_EN_US,
          label: '🇺🇸 ' + t('English'),
          onClick: () => handleLocaleChange(LOCALE_EN_US)
        },
        {
          key: LOCALE_EN_GB,
          label: '🇬🇧 ' + t('English (UK)'),
          onClick: () => handleLocaleChange(LOCALE_EN_GB)
        },
        {
          key: LOCALE_ES,
          label: '🇪🇸 ' + t('Spanish'),
          onClick: () => handleLocaleChange(LOCALE_ES)
        },
        {
          key: LOCALE_DE,
          label: '🇩🇪 ' + t('German'),
          onClick: () => handleLocaleChange(LOCALE_DE)
        },
        {
          key: LOCALE_FR,
          label: '🇫🇷 ' + t('French'),
          onClick: () => handleLocaleChange(LOCALE_FR)
        },
        {
          key: LOCALE_HI,
          label: '🇮🇳 ' + t('Hindi'),
          onClick: () => handleLocaleChange(LOCALE_HI)
        },
        {
          key: LOCALE_PT,
          label: '🇵🇹 ' + t('Portuguese'),
          onClick: () => handleLocaleChange(LOCALE_PT)
        }
      ]}
    />
  )
}
