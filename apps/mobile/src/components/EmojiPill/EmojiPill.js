import React from 'react'
import Pill from 'components/Pill'
import { TouchableOpacity } from 'react-native'

export default function EmojiPill ({ emojiFull, onPress = () => {}, count, selected, toolTip }) {
  let pillStyle = { ...styles.tagPill }
  if (selected) pillStyle = { ...pillStyle, ...styles.selected }
  return (
    <TouchableOpacity onPress={() => onPress(emojiFull)}>
      <Pill
        key={emojiFull}
        onPress={() => onPress(emojiFull)}
        style={pillStyle}
        displayColor={selected ? '#ffffff' : '#000000'}
        label={`${emojiFull} ${count}`}
        id={emojiFull}
      />
    </TouchableOpacity>
  )
}

const styles = {
  tagPill: {
    fontFamily: 'Circular Std',
    textTransform: 'none',
    fontWeight: 400,
    lineHeight: 18,
    marginBottom: 0,
    paddingTop: 5,
    paddingBottom: 5,
    paddingRight: 5,
    paddingLeft: 5,
    border: 'none',
    backgroundColor: 'rgba(237, 239, 241, 1.0)',
    borderRadius: 5
  },
  selected: {
    backgroundColor: 'rgba(0, 115, 216, 1.0)',
  }
}
