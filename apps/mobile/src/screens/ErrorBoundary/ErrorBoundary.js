import React from 'react'
import { Text, View, Button, Image } from 'react-native'
import RNRestart from 'react-native-restart'
import * as Sentry from '@sentry/react-native'
import { useTranslation } from 'react-i18next'

const axelFretting = require('assets/Axel_Fretting.png')

export default class ErrorBoundary extends React.Component {
  constructor (props) {
    super(props)
    this.state = { hasError: false }
  }

  componentDidCatch (error, info) {
    this.setState({ hasError: true })

    Sentry.captureException(error, { extra: info })
  }

  render () {
    const { customErrorUI } = this.props
    if (this.state.hasError) {
      return customErrorUI || <DefaultErrorMessage />
    }
    return this.props.children
  }
}

function DefaultErrorMessage () {
  const { t } = useTranslation()
  return (
    <View style={styles.container}>
      <Text style={styles.titleText}>{t('Oops Something Went Wrong')}</Text>
      <Image source={axelFretting} style={styles.merkabaImage} />
      <Button title={t('Restart Hylo')} style={styles.button} onPress={() => RNRestart.Restart()} />
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
