import React from 'react'
import { View, StyleSheet } from 'react-native'
import { useTranslation } from 'react-i18next'
import { useNavigation } from '@react-navigation/native'
import useCurrentGroup from '@hylo/hooks/useCurrentGroup'
import useRouteParams from 'hooks/useRouteParams'
import LegacyGroupsDrawerMenu from 'screens/LegacyGroupsDrawerMenu'
import ContextMenu from 'components/ContextMenu'

export default function DrawerMenu (props) {
  const { t } = useTranslation()
  const navigation = useNavigation()
  const { myHome, groupSlug } = useRouteParams()
  const [{ currentGroup }] = useCurrentGroup({ setToGroupSlug: groupSlug })

  return (
    <View style={styles.container}>
      <LegacyGroupsDrawerMenu {...props} style={styles.legacyMenu} />
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
  legacyMenu: {
    flex: 1
  },
  contextMenu: {
    flex: 2
  }
})
