import React, { useState } from 'react'
import { View, Text, TouchableOpacity } from 'react-native'
import Icon from 'components/Icon'

export default function Pill ({
  id,
  label,
  onRemove,
  displayColor = 'rgba(112, 239, 241, 1.0)',
  textClasses = 'text-sm',
  className,
  style,
  editable,
  onPress,
  onLongPress,
  delayLongPress,
  disabled,
  hitSlop = 2,
  ...touchableProps
}) {
  const [removing, setRemoving] = useState(false)
  const deletePill = () => {
    if (editable && onRemove) {
      if (removing) {
        onRemove(id, label)
      } else {
        setRemoving(true)
      }
    }
  }
  const mouseOut = () => setRemoving(false)

  return (
    <TouchableOpacity
      onPress={onPress}
      onLongPress={onLongPress}
      delayLongPress={delayLongPress}
      disabled={disabled}
      hitSlop={hitSlop}
      {...touchableProps}
    >
      <View
        className={`relative mr-2 mb-2 ${className}`}
        style={style}
        onMouseLeave={mouseOut}
      >
        <View>
          <Text className={textClasses}>{label}</Text>
        </View>
        {editable && (
          <Icon
            name='Ex'
            onClick={deletePill}
            className='text-xs font-bold text-transparent absolute top-1 right-1.5 p-1 rounded'
          />
        )}
      </View>
    </TouchableOpacity>
  )
}

// const styles = {
//   pill: {
//     position: 'relative',
//     marginRight: 8,
//     marginBottom: 8
//   },
//   removeLabel: {
//     fontSize: 12,
//     fontWeight: 'bold',
//     color: 'transparent',
//     position: 'absolute',
//     top: 1,
//     right: 5,
//     padding: 4,
//     borderRadius: 4,
//     verticalAlign: 'top'
//   }
// }
