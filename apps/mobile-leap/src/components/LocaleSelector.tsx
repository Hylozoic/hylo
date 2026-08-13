import { useState } from 'react'
import { Pressable, Text, View } from 'react-native'
import { useTranslation } from 'react-i18next'
import { useMutation } from 'urql'
import { useAuth } from '@hylo/contexts/AuthContext'
import updateUserSettingsMutation from '@hylo/graphql/mutations/updateUserSettingsMutation'

export default function LocaleSelector ({ compact = false }: { compact?: boolean }) {
  const { t, i18n } = useTranslation()
  const { currentUser } = useAuth()
  const [, updateUserSettings] = useMutation(updateUserSettingsMutation)
  const [open, setOpen] = useState(false)
  const selectedLocale = i18n.language?.startsWith('es') ? 'es' : 'en'

  const handleSelectLocale = (locale: 'en' | 'es') => {
    i18n.changeLanguage(locale)
    setOpen(false)
    if (!currentUser) return
    updateUserSettings({ changes: { settings: { locale } } })
  }

  return (
    <View className='z-20'>
      <Pressable
        className='rounded-md border border-border bg-white px-3 py-2'
        onPress={() => setOpen(!open)}
      >
        <Text className='text-xs text-foreground'>
          {compact ? '🌐' : `🌐 ${t('Language')}: ${selectedLocale === 'en' ? 'English' : 'Español'}`}
        </Text>
      </Pressable>
      {open && (
        <View className='absolute left-0 top-10 min-w-[160px] overflow-hidden rounded-md border border-border bg-white'>
          <Pressable
            className={`px-3 py-2 ${selectedLocale === 'en' ? 'bg-selected' : ''}`}
            onPress={() => handleSelectLocale('en')}
          >
            <Text className={selectedLocale === 'en' ? 'text-white' : 'text-foreground'}>English</Text>
          </Pressable>
          <Pressable
            className={`px-3 py-2 ${selectedLocale === 'es' ? 'bg-selected' : ''}`}
            onPress={() => handleSelectLocale('es')}
          >
            <Text className={selectedLocale === 'es' ? 'text-white' : 'text-foreground'}>Español</Text>
          </Pressable>
        </View>
      )}
    </View>
  )
}
