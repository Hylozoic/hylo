import React from 'react'
import { TouchableOpacity, Text, View } from 'react-native'
import Icon from 'components/Icon'
import styles from './TopicRow.styles'

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
          )
      }
    </TouchableOpacity>
  )
}
