import React from 'react'
import { View, StyleSheet } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import ContextMenu from 'components/ContextMenu'
import ContextSwitchMenu from 'components/ContextSwitchMenu/ContextSwitchMenu'

export default function DrawerMenu (props) {
  const insets = useSafeAreaInsets()

  return (
    <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <ContextSwitchMenu {...props} />
      <ContextMenu />
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    flex: 1
  }
})
