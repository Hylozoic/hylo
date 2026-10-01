import { Text, View } from 'react-native'
import { useTranslation } from 'react-i18next'
import errorMessages from 'util/errorMessages'

type FormattedErrorProps = {
  error?: string | Error | null
  action?: string
}

export default function FormattedError ({ error, action = 'Operation' }: FormattedErrorProps) {
  const { t } = useTranslation()
  if (!error) return null

  const message = errorMessages((error as Error)?.message || error, action)
  return (
    <View className='my-3 items-center'>
      <View className='rounded-full bg-destructive px-4 py-2'>
        <Text className='text-center text-sm text-destructive-foreground'>{t(message)}</Text>
      </View>
    </View>
  )
}
