import React from 'react'
import { View, ActivityIndicator } from 'react-native'
import { gunsmoke } from '@hylo/presenters/colors'

export default function Loading ({
  style,
  size = 'small'
}) {
  return (
    <View style={[styles.container, style]}>
      {/*
        NOTE: 'color' prop is required due to RN bug in 0.63.4.
        Without it being explcitely set the indicator will be invisble in Android.
        Remove once the bug is fixed: https://github.com/facebook/react-native/pull/29830
      */}
      <ActivityIndicator size={size} color={gunsmoke} accessibilityHint='loading' />
    </View>
  )
}

const styles = {
  container: {
    padding: 20,
    justifyContent: 'space-around'
  }
}
