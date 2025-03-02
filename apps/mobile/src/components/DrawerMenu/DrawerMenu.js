import React, { useState, useEffect, useRef } from 'react'
import { View, StyleSheet, Animated } from 'react-native'
import ContextMenu from 'components/ContextMenu'
import ContextSwitchMenu from 'components/ContextSwitchMenu/ContextSwitchMenu'

const OPENING_DURATION = 250
const CLOSING_DURATION = 50

export default function DrawerMenu (props) {
  const [isContextSwitchExpanded, setIsContextSwitchExpanded] = useState(false)
  const contextSwitchFlex = useRef(new Animated.Value(0.2)).current
  const contextMenuFlex = useRef(new Animated.Value(0.8)).current

  useEffect(() => {
    Animated.parallel([
      Animated.timing(contextSwitchFlex, {
        toValue: isContextSwitchExpanded ? 1 : 0.2,
        duration: OPENING_DURATION,
        useNativeDriver: false
      }),
      Animated.timing(contextMenuFlex, {
        toValue: isContextSwitchExpanded ? 0 : 0.8,
        duration: CLOSING_DURATION,
        useNativeDriver: false
      })
    ]).start()
  }, [isContextSwitchExpanded])

  return (
    <View style={styles.container}>
      <Animated.View style={[styles.menuContainer, { flex: contextSwitchFlex }]}>
        <ContextSwitchMenu
          {...props} 
          isExpanded={isContextSwitchExpanded}
          setIsExpanded={setIsContextSwitchExpanded}
        />
      </Animated.View>
      <Animated.View style={[styles.menuContainer, { flex: contextMenuFlex, display: isContextSwitchExpanded && 'none' }]}>
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
