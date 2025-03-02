import React from 'react'
import { TouchableOpacity, Text, View, StyleSheet } from 'react-native'
import Icon from 'components/Icon'
import { rhino40, caribbeanGreen } from 'style/colors'

export default function TopicRow ({ item, onPress }) {
  return (
    <TouchableOpacity style={styles.topicRow} onPress={() => onPress(item)}>
      <View style={styles.topicTitle}>
        <Text style={styles.hashtag}>#</Text><Text style={styles.topicName}>{item.name}</Text>
      </View>
      {item.followersTotal === undefined
        ? (
          <View style={styles.topicDetails}>
            <Text style={styles.detailText}>create new</Text>
          </View>
          )
        : (
          <View style={styles.topicDetails}>
            <Icon name='Star' style={styles.detailIcon} />
            <Text style={styles.detailText}>{item.followersTotal} subscribers</Text>
            <Icon name='Post' style={styles.detailIcon} />
            <Text style={styles.detailText}>{item.postsTotal} posts</Text>
          </View>
          )}
    </TouchableOpacity>
  )
}

const styles = StyleSheet.create({
  topicRow: {
    marginBottom: 10,
    marginHorizontal: 10,
    flexDirection: 'column'
  },
  hashtag: {
    color: caribbeanGreen,
    fontFamily: 'Circular-Book',
    fontSize: 18,
    fontStyle: 'italic',
    paddingRight: 2
  },
  topicName: {
    color: caribbeanGreen,
    fontFamily: 'Circular-Book',
    fontSize: 18
  },
  topicTitle: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: -5
  },
  topicDetails: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 7
  },
  detailIcon: {
    color: rhino40,
    marginRight: 5
  },
  detailText: {
    color: rhino40,
    fontFamily: 'Circular-Book',
    fontSize: 16,
    marginRight: 10
  }
})
