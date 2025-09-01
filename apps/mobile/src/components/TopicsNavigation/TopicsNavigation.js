import React from 'react'
import { Text, View, TouchableOpacity } from 'react-native'
import { useTranslation } from 'react-i18next'
import { useCurrentGroup } from '@hylo/hooks/useCurrentGroup'
import { useCurrentUser } from '@hylo/hooks/useCurrentUser'
import Badge from 'components/Badge'
import Icon from 'components/Icon'
import Loading from 'components/Loading/Loading'
import useEnsureGroupTopics from 'hooks/useEnsureGroupTopics'
import useGoToTopic from 'hooks/useGoToTopic'
import Colors from '../../style/theme-colors'

export default function TopicsNavigation ({ group }) {
  const { pending, topics } = useEnsureGroupTopics({ groupId: group?.id, groupSlug: group?.slug })
  const goToTopic = useGoToTopic()

  if (pending || !group) return (<Loading />)

  return (
    <View style={{ marginBottom: 20 }}>
      {topics.map((topic, index) => (
        <TopicItem
          label={topic.name}
          iconName='Topics'
          topic={topic}
          key={index}
          onPress={() => goToTopic(topic.name)}
        />
      ))}
    </View>
  )
}

const TopicItem = ({ label, iconName, onPress, topic }) => (
  <TouchableOpacity style={styles.topicItem} onPress={onPress} key={label}>
    <View style={styles.topicSubItem}>
      <Icon style={styles.topicItemIcon} name={iconName} />
      <Text style={styles.topicItemLabel}>{label}</Text>
    </View>
    <View style={[styles.topicSubItem, styles.topicRightSide]}>
      {topic.newPostCount > 0 && <Badge count={topic.newPostCount} />}
      {(topic.visibility === 2) && (<Icon style={styles.topicItemIcon} name='Pin' />)}
    </View>
  </TouchableOpacity>
)

const styles = {
  topicItemLabel: {
    color: Colors.foreground05,
    fontSize: 16
  },
  topicItemIcon: {
    color: Colors.foreground05,
    fontSize: 16
  },
  topicItem: {
    color: Colors.mutedForeground,
    flexDirection: 'row',
    alignItems: 'center',
    paddingBottom: 8,
    justifyContent: 'space-between'
  },
  topicSubItem: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  topicRightSide: {
    marginRight: 20,
    gap: 4
  }
}
