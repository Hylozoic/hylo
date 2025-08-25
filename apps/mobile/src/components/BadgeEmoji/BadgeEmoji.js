import React from 'react'
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import Colors from '../../style/theme-colors'

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

const styles = StyleSheet.create({
  container: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    verticalAlign: 'middle',
    textAlign: 'center',
    width: 24,
    height: 24,
    marginRight: 1,
    backgroundColor: Colors.selected20,
    borderRadius: 30,
    border: 1,
    borderColor: '#ffd192'

  },
  emoji: {
    fontSize: 16,
    backgroundColor: Colors.selected20,
    borderRadius: 12,
    padding: 4,
    borderWidth: 1,
    borderColor: Colors.accent
  },
  isSteward: {
    backgroundColor: Colors.accent20,
    borderRadius: 30,
    border: 1,
    borderColor: Colors.accent
  },
  steward: {
    backgroundColor: Colors.accent20,
    borderColor: Colors.accent
  }
})
