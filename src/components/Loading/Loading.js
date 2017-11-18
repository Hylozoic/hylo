import React from 'react'
import { View, ActivityIndicator } from 'react-native'

export default function Loading ({ style }) {
  return <View style={[style, styles.container]}>
    <ActivityIndicator />
  </View>
}

export function LoadingScreen () {
  return <Loading style={{flex: 1}} />
}

const styles = {
  container: {
    justifyContent: 'space-around'
  },
  text: {
    textAlign: 'center'
  }
}
