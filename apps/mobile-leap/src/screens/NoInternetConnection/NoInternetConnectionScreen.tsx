import { useEffect } from 'react'
import { Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useTranslation } from 'react-i18next'
import Button from '../../components/Button'
import useNetworkConnectivity from '../../hooks/useNetworkConnectivity'

type NoInternetConnectionProps = {
  onRetry?: () => void
}

export default function NoInternetConnectionScreen ({ onRetry }: NoInternetConnectionProps) {
  const { t } = useTranslation()
  const { isConnected, isInternetReachable } = useNetworkConnectivity()

  useEffect(() => {
    if (isConnected && isInternetReachable && onRetry) onRetry()
  }, [isConnected, isInternetReachable, onRetry])

  return (
    <SafeAreaView className='flex-1 bg-background' edges={['top', 'left', 'right', 'bottom']}>
      <View className='flex-1 items-center justify-center px-8'>
        <Text className='mb-3 text-center text-xl font-semibold text-foreground'>
          {t('No Internet Connection')}
        </Text>
        <Text className='mb-8 text-center text-muted-foreground'>
          {t('Hylo requires an internet connection to work. Please check your connection and try again.')}
        </Text>
        <Button text={t('Retry')} onPress={onRetry} className='min-w-[50%]' />
      </View>
    </SafeAreaView>
  )
}
