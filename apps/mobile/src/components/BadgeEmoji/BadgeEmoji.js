import React from 'react'
import { View, Text, TouchableOpacity } from 'react-native'

export default function Badge ({ emoji, onPress, isSteward, extraStyle, emojiStyle }) {
  if (!emoji) return null

  return (
    <TouchableOpacity onPress={onPress}>
      <View style={[styles.container, isSteward && styles.isSteward, extraStyle]}>
        <Text style={[styles.emoji, emojiStyle]}>{emoji}</Text>
      </View>
    </TouchableOpacity>
  )
}

const styles = {
  container: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    verticalAlign: 'middle',
    textAlign: 'center',
    width: 24,
    height: 24,
    marginRight: 1,
    backgroundColor: '#d1f3e9',
    borderRadius: 30,
    border: 1,
    borderColor: '#ffd192'

  },
  emoji: {
    fontSize: 13,
    lineHeight: 18,
    color: 'white',
    position: 'relative'
  },
  isSteward: {
    backgroundColor: '#ffe8c8',
    borderRadius: 30,
    border: 1,
    borderColor: '#ffd192'
  }
}
