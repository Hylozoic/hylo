import React from 'react'
import {
  Text,
  TouchableOpacity
} from 'react-native'
import { caribbeanGreen } from 'style/colors'
import { propTypesForItemRowComponent } from 'screens/ItemChooser'
import Avatar from 'components/Avatar'
import RoundCheckbox from 'components/RoundCheckBox'

export default function ItemChooserItemRow ({
  item,
  chosen,
  toggleChosen
}) {
  return (
    <TouchableOpacity style={styles.itemRow} onPress={() => toggleChosen(item)}>
      <Avatar style={styles.itemAvatar} avatarUrl={item.avatarUrl} dimension={30} />
      <Text style={styles.itemName}>{item.name}</Text>
      <RoundCheckbox
        style={styles.checkbox}
        checked={chosen}
        backgroundColor={caribbeanGreen}
        onValueChange={() => toggleChosen(item)}
      />
    </TouchableOpacity>
  )
}
ItemChooserItemRow.propTypes = propTypesForItemRowComponent

const styles = {
  itemRow: {
    padding: 15,
    paddingBottom: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start'
  },
  itemAvatar: {
    marginRight: 12
  },
  itemName: {
    fontFamily: 'Circular-Bold',
    flex: 1
  },
  checkbox: {
    marginLeft: 'auto',
    width: 50,
    alignItems: 'center',
    justifyContent: 'flex-start'

  }
}
