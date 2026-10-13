import React from 'react'
import { Text, View, TouchableOpacity } from 'react-native'
import { slice } from 'lodash/fp'
import Avatar from 'components/Avatar'
import { rhino30 } from '@hylo/presenters/colors'

export default function ProjectMembersSummary ({ members, onPress, style, dimension = 43 }) {
  const membersTotal = members.length

  if (membersTotal < 1) return null

  const membersText = `${membersTotal} member${membersTotal === 1 ? '' : 's'}`
  const RootElement = onPress ? TouchableOpacity : View

  return (
    <RootElement onPress={onPress} style={[styles.membersSummary, style]}>
      {slice(0, 3, members).map((c, index) => {
        return (
          <Avatar
            key={index}
            dimension={dimension}
            avatarUrl={c.avatarUrl}
            hasBorder
            hasOverlap={index > 0}
            zIndex={3 - index}
          />
        )
      })}
      <Text style={styles.membersText}>{membersText}</Text>
    </RootElement>
  )
}

const styles = {
  membersSummary: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10
  },
  membersText: {
    paddingLeft: 6,
    color: rhino30,
    fontSize: 13,
    fontFamily: 'Circular-Book'
  }
}
