import { type ReactNode } from 'react'
import { reloadAppAsync } from 'expo'
import { useTranslation } from 'react-i18next'
import { Button, Text, View } from 'react-native'
import * as Sentry from '@sentry/react-native'
import { clearAllExceptSessionCookie } from 'util/session'

function DefaultErrorMessage () {
  const { t } = useTranslation()

  const handleRestart = async () => {
    try {
      // Clear app cache but preserve the session cookie to keep HyloWebView working
      await clearAllExceptSessionCookie()
    } catch (error) {
      console.warn('Failed to clear cache before restart:', error)
    }
    await reloadAppAsync('ErrorBoundary restart')
  }

  return (
    <View className='flex-1 items-center justify-center bg-background px-6'>
      <Text className='mb-6 text-center text-xl font-medium text-foreground'>
        {t('Oops Something Went Wrong')}
      </Text>
      <Button title={t('Restart Hylo')} onPress={handleRestart} />
    </View>
  )
}

type ErrorBoundaryProps = {
  children: ReactNode
}

export default function ErrorBoundary ({ children }: ErrorBoundaryProps) {
  return (
    <Sentry.ErrorBoundary fallback={<DefaultErrorMessage />}>
      {children}
    </Sentry.ErrorBoundary>
  )
}
