import React, { useState, useEffect, useRef } from 'react'
import { View, StyleSheet, Animated } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import ContextMenu from 'components/ContextMenu'
import ContextSwitchMenu from 'components/ContextSwitchMenu/ContextSwitchMenu'

const OPENING_DURATION = 250
const CLOSING_DURATION = 100

export default function DrawerMenu (props) {
  const insets = useSafeAreaInsets()
  const [isContextSwitchExpanded, setIsContextSwitchExpanded] = useState(false)
  const switchMenuFlex = useRef(new Animated.Value(0.22)).current
  const contextMenuFlex = useRef(new Animated.Value(0.78)).current

  useEffect(() => {
    Animated.parallel([
      Animated.timing(switchMenuFlex, {
        toValue: isContextSwitchExpanded ? 0.78 : 0.22,
        duration: OPENING_DURATION,
        useNativeDriver: false
      }),
      Animated.timing(contextMenuFlex, {
        toValue: isContextSwitchExpanded ? 0.22 : 0.78,
        duration: CLOSING_DURATION,
        useNativeDriver: false
      })
    ]).start()
  }, [isContextSwitchExpanded])

  return (
    <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <Animated.View style={[styles.menuContainer, { flex: switchMenuFlex }]}>
        <ContextSwitchMenu 
          {...props} 
          isExpanded={isContextSwitchExpanded}
          setIsExpanded={setIsContextSwitchExpanded}
        />
      </Animated.View>
      <Animated.View style={[styles.menuContainer, { flex: contextMenuFlex }]}>
        <ContextMenu 
          isContextSwitchExpanded={isContextSwitchExpanded}
        />
      </Animated.View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    flex: 1
  },
  menuContainer: {
    height: '100%',
    overflow: 'hidden'
  }
})
