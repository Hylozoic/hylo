import React from 'react'
import { View, StyleSheet } from 'react-native'
import { useTranslation } from 'react-i18next'
import { useNavigation } from '@react-navigation/native'
import useCurrentGroup from '@hylo/hooks/useCurrentGroup'
import useRouteParams from 'hooks/useRouteParams'
import ContextMenu from 'components/ContextMenu'
import ContextSwitchMenu from 'components/ContextSwitchMenu/ContextSwitchMenu'

export default function DrawerMenu (props) {
  const { t } = useTranslation()
  const navigation = useNavigation()
  const { myHome, groupSlug } = useRouteParams()
  const [{ currentGroup }] = useCurrentGroup({ setToGroupSlug: groupSlug })

  return (
    <View style={styles.container}>
      <ContextSwitchMenu {...props} style={styles.contextSwitchMenu} />
      <ContextMenu style={styles.contextMenu} />
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'stretch',
    flex: 1
  },
  contextSwitchMenu: {
    flex: 1
  },
  contextMenu: {
    flex: 2
  }
})
