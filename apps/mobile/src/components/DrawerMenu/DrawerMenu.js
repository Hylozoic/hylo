import React from 'react'
import { View, StyleSheet } from 'react-native'
import useCurrentGroup from '@hylo/hooks/useCurrentGroup'
import useRouteParams from 'hooks/useRouteParams'
import { SafeAreaView } from 'react-native-safe-area-context'
import ContextMenu from 'components/ContextMenu'
import ContextSwitchMenu from 'components/ContextSwitchMenu/ContextSwitchMenu'

export default function DrawerMenu (props) {
  const { myHome, groupSlug } = useRouteParams()
  useCurrentGroup({ setToGroupSlug: groupSlug })

  return (
    <SafeAreaView style={styles.container}>
      <ContextSwitchMenu {...props} />
      <ContextMenu />
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    flex: 1
  }
})
