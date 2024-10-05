import React from 'react'
import {
  Text,
  TouchableOpacity
} from 'react-native'
import { propTypesForItemRowComponent } from 'screens/ItemChooser'
import Avatar from 'components/Avatar'

export default function PersonPickerItemRow ({
  item,
  onPress
}) {
  return (
    <TouchableOpacity style={styles.personRow} onPress={() => onPress(item)}>
      <Avatar style={styles.personAvatar} avatarUrl={item.avatarUrl} dimension={30} />
      <Text style={styles.personName}>{item.name}</Text>
    </TouchableOpacity>
  )
}
PersonPickerItemRow.propTypes = propTypesForItemRowComponent

const styles = {
  personRow: {
    padding: 15,
    paddingBottom: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start'
  },
  personAvatar: {
    marginRight: 12
  },
  personName: {
    fontFamily: 'Circular-Bold',
    flex: 1
  }
}
