import React, { useState, useEffect, useRef } from 'react'
import { View, Animated, LayoutAnimation } from 'react-native'
import ContextMenu from 'components/ContextMenu'
import ContextSwitchMenu from 'components/ContextSwitchMenu/ContextSwitchMenu'

const COLLAPSED_SWITCH_WIDTH = 0.15
const EXPANDED_SWITCH_WIDTH = 1
const COLLAPSED_MENU_WIDTH = 0.85
const EXPANDED_MENU_WIDTH = 0

const OPENING_DURATION = 150
const CLOSING_DURATION = 150

export default function DrawerMenu (props) {
  const [isContextSwitchExpanded, setIsContextSwitchExpanded] = useState(false)
  const contextSwitchWidth = useRef(new Animated.Value(COLLAPSED_SWITCH_WIDTH)).current
  const contextMenuWidth = useRef(new Animated.Value(COLLAPSED_MENU_WIDTH)).current

  useEffect(() => {
    // One of a few things that can be played with to change/improve animation behavior:
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut)

    Animated.parallel([
      Animated.timing(contextSwitchWidth, {
        toValue: isContextSwitchExpanded ? EXPANDED_SWITCH_WIDTH : COLLAPSED_SWITCH_WIDTH,
        duration: OPENING_DURATION,
        useNativeDriver: false
      }),
      Animated.timing(contextMenuWidth, {
        toValue: isContextSwitchExpanded ? EXPANDED_MENU_WIDTH : COLLAPSED_MENU_WIDTH,
        duration: CLOSING_DURATION,
        useNativeDriver: false
      })
    ]).start()
  }, [isContextSwitchExpanded])

  return (
    <View style={{ flexDirection: 'row', flex: 1 }}>
      <Animated.View
        style={[
          {
            width: contextSwitchWidth.interpolate({
              inputRange: [COLLAPSED_SWITCH_WIDTH, EXPANDED_SWITCH_WIDTH],
              outputRange: [`${COLLAPSED_SWITCH_WIDTH * 100}%`, `${EXPANDED_SWITCH_WIDTH * 100}%`]
            })
          }
        ]}
      >
        <ContextSwitchMenu
          {...props}
          isExpanded={isContextSwitchExpanded}
          setIsExpanded={setIsContextSwitchExpanded}
        />
      </Animated.View>
      <Animated.View
        style={{
          opacity: contextMenuWidth,
          width: contextMenuWidth.interpolate({
            inputRange: [EXPANDED_MENU_WIDTH, COLLAPSED_MENU_WIDTH],
            outputRange: [`${EXPANDED_MENU_WIDTH * 100}%`, `${COLLAPSED_MENU_WIDTH * 100}%`]
          })
        }}
      >
        <ContextMenu isContextSwitchExpanded={isContextSwitchExpanded} />
      </Animated.View>
    </View>
  )
}
