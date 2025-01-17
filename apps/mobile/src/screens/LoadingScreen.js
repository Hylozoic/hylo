import React from 'react'
import { SafeAreaView } from 'react-native-safe-area-context'
import Loading from 'components/Loading'

export default function LoadingScreen () {
  return (
    <SafeAreaView style={styles.container}>
      <Loading size='large' />
    </SafeAreaView>
  )
}

const styles = {
  container: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center'
  }
}
