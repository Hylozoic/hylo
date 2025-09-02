import React, { useState } from 'react'
import { Text, View, Button, Image } from 'react-native'
import RNRestart from 'react-native-restart'
import * as Sentry from '@sentry/react-native'
import { useTranslation } from 'react-i18next'
import AsyncStorage from '@react-native-async-storage/async-storage'

const axelFretting = require('assets/Axel_Fretting.png')

const ErrorBoundary = ({ children, customErrorUI }) => {
  const [hasError, setHasError] = useState(false)

  const handleError = (error, info) => {
    setHasError(true)
    Sentry.captureException(error, { extra: info })
  }

  if (hasError) {
    return customErrorUI || <DefaultErrorMessage />
  }

  return (
    <Sentry.ErrorBoundary onError={handleError} fallback={customErrorUI || <DefaultErrorMessage />}>
      {children}
    </Sentry.ErrorBoundary>
  )
}

const DefaultErrorMessage = () => {
  const { t } = useTranslation()
  
  const handleRestart = async () => {
    try {
      await AsyncStorage.clear()
      console.log('Cache cleared before restart')
    } catch (error) {
      console.error('Failed to clear cache before restart:', error)
    }
    
    // Restart the app
    RNRestart.Restart()
  }
  
  return (
    <View style={styles.container}>
      <Text style={styles.titleText}>{t('Oops Something Went Wrong')}</Text>
      <Image source={axelFretting} style={styles.merkabaImage} />
      <Button title={t('Restart Hylo')} style={styles.button} onPress={handleRestart} />
    </View>
  )
}

const styles = {
  titleText: {
    fontSize: 25,
    paddingBottom: 25
  },
  container: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'white',
    flex: 1
  },
  merkabaImage: {
    height: 97,
    width: 97,
    marginBottom: 25
  },
  button: {
    marginTop: 20
  }
}

export default ErrorBoundary
