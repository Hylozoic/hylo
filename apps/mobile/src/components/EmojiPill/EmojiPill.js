import React from 'react'
import Pill from 'components/Pill'
import { TouchableOpacity } from 'react-native'

export default function EmojiPill ({ emojiFull, onPress = () => {}, count, selected, toolTip }) {
  return (
    <TouchableOpacity onPress={() => onPress(emojiFull)}>
      <Pill
        key={emojiFull}
        onPress={() => onPress(emojiFull)}
        className={`py-1.5 px-1.5 rounded font-normal leading-[18px] mb-0 ${selected ? 'bg-secondary' : 'bg-muted'}`}
        textClasses={selected ? 'text-foreground' : 'text-foreground'}
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
