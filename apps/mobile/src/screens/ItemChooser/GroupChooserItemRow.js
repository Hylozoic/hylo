import React from 'react'
import { Text, TouchableOpacity } from 'react-native'
import { propTypesForItemRowComponent } from 'screens/ItemChooser'
import Avatar from 'components/Avatar'

export default function GroupChooserItemRow ({ item, onPress }) {
  return (
    <TouchableOpacity style={styles.groupRow} onPress={() => onPress(item)}>
      <Avatar style={styles.groupAvatar} avatarUrl={item.avatarUrl} dimension={30} />
      <Text style={styles.groupName}>{item.name}</Text>
    </TouchableOpacity>
  )
}

GroupChooserItemRow.propTypes = propTypesForItemRowComponent

const styles = {
  groupRow: {
    padding: 15,
    paddingBottom: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start'
  },
  groupAvatar: {
    marginRight: 12
  },
  groupName: {
    fontFamily: 'Circular-Bold',
    flex: 1
  }
}
