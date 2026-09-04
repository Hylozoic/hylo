// @ts-nocheck
import { Pressable, Text, View } from 'react-native'
import { useTranslation } from 'react-i18next'

// Minimal stack header for non-auth modal screens (ForgotPassword, etc.).
export default function ModalHeader ({ options, navigation }) {
  const { t } = useTranslation()
  const title = typeof options.title === 'string'
    ? options.title
    : options.headerTitle?.toString()

  return (
    <View className='border-b border-border bg-background px-4 pb-3 pt-14'>
      <View className='flex-row items-center justify-between'>
        <Pressable onPress={() => navigation.goBack()} hitSlop={8}>
          <Text className='text-base text-primary'>{t('Back')}</Text>
        </Pressable>
        <Text className='text-base font-semibold text-foreground'>{title}</Text>
        <View className='w-12' />
      </View>
    </View>
  )
}
