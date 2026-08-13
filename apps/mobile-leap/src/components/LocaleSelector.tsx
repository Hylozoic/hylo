import { useState } from 'react'
import { Pressable, Text, View } from 'react-native'
import { useTranslation } from 'react-i18next'
import { useMutation } from 'urql'
import { useAuth } from '@hylo/contexts/AuthContext'
import {
  UI_LOCALES,
  localeToFlagEmoji,
  localeToNameKey,
  normalizeLocaleToFull
} from '@hylo/shared'
import updateUserSettingsMutation from '@hylo/graphql/mutations/updateUserSettingsMutation'
import { persistLocale } from '../i18n'

export default function LocaleSelector ({ compact = false }: { compact?: boolean }) {
  const { t, i18n } = useTranslation()
  const { currentUser } = useAuth()
  const [, updateUserSettings] = useMutation(updateUserSettingsMutation)
  const [open, setOpen] = useState(false)
  const selectedLocale = normalizeLocaleToFull(i18n.language)

  const handleSelectLocale = (locale: string) => {
    const normalizedLocale = normalizeLocaleToFull(locale)
    i18n.changeLanguage(normalizedLocale)
    persistLocale(normalizedLocale)
    setOpen(false)
    if (!currentUser) return
    updateUserSettings({ changes: { settings: { locale: normalizedLocale } } })
  }

  return (
    <View className='z-20'>
      <Pressable
        className='rounded-md border border-border bg-white px-3 py-2'
        onPress={() => setOpen(!open)}
      >
        <Text className='text-xs text-foreground'>
          {compact
            ? `🌐 ${localeToFlagEmoji(selectedLocale)}`
            : `🌐 ${t('Language')}: ${localeToFlagEmoji(selectedLocale)} ${t(localeToNameKey(selectedLocale))}`}
        </Text>
      </Pressable>
      {open && (
        <View className='absolute left-0 top-10 min-w-[200px] overflow-hidden rounded-md border border-border bg-white'>
          {UI_LOCALES.map(locale => {
            const selected = selectedLocale === locale
            return (
              <Pressable
                key={locale}
                className={`px-3 py-2 ${selected ? 'bg-selected' : ''}`}
                onPress={() => handleSelectLocale(locale)}
              >
                <Text className={selected ? 'text-white' : 'text-foreground'}>
                  {localeToFlagEmoji(locale)} {t(localeToNameKey(locale))}
                </Text>
              </Pressable>
            )
          })}
        </View>
      )}
    </View>
  )
}
