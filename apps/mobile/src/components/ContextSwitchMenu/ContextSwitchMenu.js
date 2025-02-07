import React, { useState } from 'react'
import { Animated, TouchableOpacity, Text, StyleSheet, SectionList } from 'react-native'
import FastImage from 'react-native-fast-image'
import useCurrentUser from '@hylo/hooks/useCurrentUser'
import useChangeToGroup from 'hooks/useChangeToGroup'

export default function SlimGroupsMenu () {
  const [{ currentUser }] = useCurrentUser()
  const changeToGroup = useChangeToGroup()

  const [expanded, setExpanded] = useState(false)

  const myGroups = currentUser.memberships.map(m => m.group).sort((a, b) => a.name.localeCompare(b.name))

  return (
    <Animated.View style={styles.menuContainer}>
      <SectionList
        sections={[{ data: myGroups }]}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <TouchableOpacity
            key={item.id}
            onPress={() => changeToGroup(item?.slug, false)}
            style={styles.groupRow}
            activeOpacity={0.7}
          >
            <FastImage source={{ uri: item.avatarUrl }} style={styles.groupIcon} />
            {expanded && <Text style={styles.groupText}>{item.name}</Text>}
          </TouchableOpacity>
        )}
        showsVerticalScrollIndicator={false}
      />
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  menuContainer: {
    backgroundColor: '#222',
    overflow: 'hidden',
    paddingVertical: 10
  },
  expandButton: {
    paddingVertical: 10,
    alignItems: 'center',
    backgroundColor: '#333'
  },
  expandButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: 'bold'
  },
  groupRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 8
  },
  groupIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 10
  },
  groupText: {
    fontSize: 14,
    color: 'white',
    flexShrink: 1
  }
})
