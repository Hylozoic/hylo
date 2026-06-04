import React from 'react'
import { Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useTranslation } from 'react-i18next'
import Button from 'components/Button'
import { twBackground } from '@hylo/presenters/colors'
import useNetworkConnectivity from 'hooks/useNetworkConnectivity'

/**
 * Screen displayed when there is no internet connectivity
 * Shows a message explaining the app requires internet and provides a retry button
 */
export default function NoInternetConnection ({ onRetry }) {
  const { t } = useTranslation()
  const { isConnected, isInternetReachable } = useNetworkConnectivity()

  // If connectivity is restored, trigger retry callback
  React.useEffect(() => {
    if (isConnected && isInternetReachable && onRetry) {
      onRetry()
    }
  }, [isConnected, isInternetReachable, onRetry])

  const handleRetry = () => {
    if (onRetry) {
      onRetry()
    }
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right', 'bottom']}>
      <View style={styles.content}>
        <Text style={styles.title}>{t('No Internet Connection')}</Text>
        <Text style={styles.message}>
          {t('Hylo requires an internet connection to work. Please check your connection and try again.')}
        </Text>
        <Button
          text={t('Retry')}
          onPress={handleRetry}
          style={styles.button}
        />
      </View>
    </SafeAreaView>
  )
}

const styles = {
  container: {
    flex: 1,
    backgroundColor: twBackground,
    justifyContent: 'center',
    alignItems: 'center'
  },
  content: {
    paddingHorizontal: 32,
    alignItems: 'center',
    maxWidth: 400
  },
  title: {
    fontSize: 24,
    fontFamily: 'Circular-Bold',
    color: '#000',
    marginBottom: 16,
    textAlign: 'center'
  },
  message: {
    fontSize: 16,
    fontFamily: 'Circular',
    color: '#666',
    marginBottom: 32,
    textAlign: 'center',
    lineHeight: 24
  },
  button: {
    minWidth: 120,
    height: 44,
    fontSize: 16
  }
}

