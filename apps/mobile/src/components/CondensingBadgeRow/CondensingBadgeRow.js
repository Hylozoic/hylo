import React, { useState } from 'react'
import { View, Text, TouchableOpacity } from 'react-native'
import BadgeEmoji from 'components/BadgeEmoji'
import { white80onCaribbeanGreen, white40onCaribbeanGreen } from 'style/colors'

export default function CondensingBadgeRow ({ postId, creatorIsSteward, badges, currentGroup, containerStyle, limit = 3 }) {
  const moderatorCount = creatorIsSteward ? 1 : 0
  const [showAllBadges, setShowAllBadges] = useState(false)

  const handleShowBadges = () => {
    setShowAllBadges(!showAllBadges)
    setTimeout(() => setShowAllBadges(false), 5000)
  }

  return (
    <View style={[styles.badgeRow, containerStyle]}>
      <TouchableOpacity styles={styles.badgeRow} hitSlop={5} onPress={handleShowBadges}>
        {badges.length + moderatorCount <= limit
          ? (
            <View style={styles.badgeRow}>
              {badges.map(badge => <BadgeEmoji isSteward={creatorIsSteward} onPress={handleShowBadges} key={badge.name} {...badge} id={postId} />)}
            </View>)
          : (
            <View style={styles.badgePill}>
              <BadgeEmoji isSteward={creatorIsSteward} onPress={handleShowBadges} extraStyle={{ height: 20, width: 16 }} key={badges[0].name} {...badges[0]} id={postId} />
              <Text>+{badges.length - 1} </Text>
            </View>
            )
        }
      </TouchableOpacity>
      {showAllBadges &&
        <View style={styles.allBadgesPill}>
          {badges.map(badge => (
            <View key={badge.name} style={{flex: 1, flexDirection: 'row', alignItems: 'center', paddingLeft: 2, paddingRight: 4, gap: 2 }}>
              <BadgeEmoji extraStyle={{ height: 26, width: 26 }} emojiStyle={{ fontSize: 20, lineHeight: 22 }} {...badge} id={postId} />
              <Text>{badge.name}</Text>
            </View>))}
        </View>}
    </View>
  )
}

const styles = {
  allBadgesPill: {
    backgroundColor: white40onCaribbeanGreen,
    borderRadius: 10,
    border: 1,
    padding: 2,
    flex: 1,
    gap: 2,
    borderColor: white40onCaribbeanGreen,
    position: 'absolute',
    bottom: 30
  },
  badgePill: {
    backgroundColor: white80onCaribbeanGreen,
    borderRadius: 30,
    border: 1,
    padding: 2,
    gap: -3,
    flex: 1,
    flexDirection: 'row',
    borderColor: white80onCaribbeanGreen,
    alignItems: 'center',
    justifyContent: 'center'
  },
  badgeRow: {
    display: 'flex',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 1,
    marginRight: 1
  }
}
