import React from 'react'
import { View, Text } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import useRouteParams from 'hooks/useRouteParams'

export default function LoadingScreen () {
  const insets = useSafeAreaInsets()
  const routeParams = useRouteParams()

  return (
    <View style={[styles.container, { paddingBottom: insets.bottom, paddingTop: insets.top }]}>
      <Text style={styles.text}>
        {JSON.stringify(routeParams, null, 2)}
      </Text>
    </View>
  )
}

const styles = {
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 16
  },
  text: {
    fontSize: 14,
    color: '#333',
    textAlign: 'center'
  }
}