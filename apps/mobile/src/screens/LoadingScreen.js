import React from 'react'
import { View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import Loading from 'components/Loading'

export default function LoadingScreen () {
  const insets = useSafeAreaInsets()
  return (
    <View style={[styles.container, { paddingBottom: insets.bottom, paddingTop: insets.top }]}>
      <Loading size='large' />
    </View>
  )
}

const styles = {
  container: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center'
  }
}
