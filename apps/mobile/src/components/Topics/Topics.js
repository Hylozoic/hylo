import React from 'react'
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import Icon from 'components/Icon'
import { amaranth, white } from '@hylo/presenters/colors'
import Colors from '../../style/theme-colors'

export default function Topics ({
  onPress,
  onPressRemove,
  topics,
  style,
  pillStyle,
  textStyle
}) {
  if (!topics || topics.length < 1) return null

  return (
    <View style={[styles.topicPillBox, style]}>
      {topics.map((topic, index) => (
        <TopicPill
          style={pillStyle}
          textStyle={textStyle}
          topic={topic}
          onPress={onPress}
          onPressRemove={onPressRemove}
          key={index}
        />
      ))}
    </View>
  )
}

export function TopicPill ({
  topic, topic: { name },
  style,
  textStyle,
  onPress,
  onPressRemove
}) {
  const handleOnPress = onPress
    ? () => onPress(topic)
    : () => {}
  const handleOnPressRemove = onPressRemove
    ? () => onPressRemove(topic)
    : () => {}

  return (
    <TouchableOpacity onPress={handleOnPress} activeOpacity={0.6} style={[styles.topicPill, style]}>
      <Text style={[styles.topicText, textStyle]}>#{name}</Text>
      {onPressRemove && (
        <TouchableOpacity onPress={handleOnPressRemove}>
          <Icon name='Ex' style={styles.topicRemove} />
        </TouchableOpacity>
      )}
    </TouchableOpacity>
  )
}

const styles = {
  topicPillBox: {
    display: 'flex',
    flexDirection: 'row'
  },
  topicPill: {
    display: 'flex',
    alignItems: 'center',
    flexDirection: 'row',
    backgroundColor: white,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: Colors.foreground30,
    marginRight: 5,
    paddingVertical: 3,
    paddingHorizontal: 7,
    paddingRight: 5
  },
  topicRemove: {
    color: amaranth,
    fontSize: 16,
    marginLeft: 10
  },
  topicText: {
    color: Colors.selected,
    fontFamily: 'Circular-Bold',
    fontSize: 12
  }
}
