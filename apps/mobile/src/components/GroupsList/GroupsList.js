import React from 'react'
import { chunk } from 'lodash/fp'
import { TouchableOpacity, Text, View } from 'react-native'
import FastImage from 'react-native-fast-image'
import { DEFAULT_AVATAR } from 'presenters/GroupPresenter'
import { caribbeanGreen } from 'style/colors'

export default function GroupsList ({
  groups = [],
  columns = 2,
  style,
  ...forwardedProps
}) {
  return chunk(columns, groups).map(groupsRow => (
    <View style={[styles.groupRow, styles.row, style]} key={groupsRow[0]?.id}>
      {groupsRow.map(group => (
        <GroupCell group={group} {...forwardedProps} key={group?.id} />
      ))}
    </View>
  ))
}

export function GroupCell ({ group, onPress, onRemove, RemoveIcon }) {
  const { name, avatarUrl } = group
  const imageSource = { uri: avatarUrl || DEFAULT_AVATAR }

  return (
    <View style={styles.groupCellContainer}>
      <TouchableOpacity style={[styles.groupCell, styles.row]} onPress={() => onPress && onPress(group?.slug)}>
        <FastImage source={imageSource} style={styles.groupAvatar} />
        <Text style={[styles.linkText, styles.groupCell, !RemoveIcon && styles.linkTextSmaller]} numberOfLines={1}>{name}</Text>
        {RemoveIcon && (
          <TouchableOpacity
            style={styles.removeIcon}
            hitSlop={{ top: 5, right: 5, left: 5, bottom: 5 }}
            onPress={() => onRemove(group?.slug)}
          >
            <RemoveIcon />
          </TouchableOpacity>
        )}
      </TouchableOpacity>
    </View>
  )
}

const styles = {
  row: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center'
  },
  groupRow: {
    paddingVertical: 8
  },
  linkText: {
    color: caribbeanGreen,
    fontSize: 14,
    paddingRight: 10,
    fontFamily: 'Circular-Book'
  },
  linkTextSmaller: {
    fontSize: 12
  },
  groupCellContainer: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center'
  },
  groupCell: {
    marginRight: 0,
    flex: 1
  },
  groupAvatar: {
    height: 20,
    width: 20,
    borderRadius: 4,
    marginRight: 9
  }
}
