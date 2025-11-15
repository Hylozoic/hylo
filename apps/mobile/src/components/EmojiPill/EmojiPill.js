import React, { useState } from 'react'
import Pill from 'components/Pill'
import { Modal, View, Text, TouchableWithoutFeedback } from 'react-native'

export default function EmojiPill ({ emojiFull, onPress = () => {}, count, selected, toolTip, allReactions = [] }) {
  const [showTooltip, setShowTooltip] = useState(false)

  const handleLongPress = () => {
    if (allReactions && allReactions.length > 0) {
      setShowTooltip(true)
    }
  }

  const handleCloseTooltip = () => {
    setShowTooltip(false)
  }

  // Format all reactions with emoji next to each user name
  const tooltipText = allReactions && allReactions.length > 0
    ? allReactions.map(reaction => `${reaction.emojiFull} ${reaction.user.name}`).join('\n')
    : toolTip || ''

  return (
    <>
      <Pill
        key={emojiFull}
        onPress={() => onPress(emojiFull)}
        onLongPress={handleLongPress}
        className={`py-1.5 px-1.5 rounded font-normal leading-[18px] mb-0 ${selected ? 'bg-secondary' : 'bg-muted'}`}
        textClasses={selected ? 'text-foreground' : 'text-foreground'}
        label={`${emojiFull} ${count}`}
        id={emojiFull}
      />
      <Modal
        visible={showTooltip}
        transparent={true}
        animationType="fade"
        onRequestClose={handleCloseTooltip}
      >
        <TouchableWithoutFeedback onPress={handleCloseTooltip}>
          <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0, 0, 0, 0.5)' }}>
            <TouchableWithoutFeedback>
              <View className="bg-foreground rounded-lg p-4 max-w-[80%]">
                <Text className="text-background text-sm">{tooltipText}</Text>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
    </>
  )
}

// const styles = {
//   tagPill: {
//     fontFamily: 'Circular Std',
//     textTransform: 'none',
//     fontWeight: 400,
//     lineHeight: 18,
//     marginBottom: 0,
//     paddingTop: 5,
//     paddingBottom: 5,
//     paddingRight: 5,
//     paddingLeft: 5,
//     border: 'none',
//     backgroundColor: 'rgba(237, 239, 241, 1.0)',
//     borderRadius: 5
//   },
//   selected: {
//     backgroundColor: 'rgba(0, 115, 216, 1.0)'
//   }
// }
