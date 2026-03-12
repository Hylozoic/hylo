import React, { useCallback } from 'react'
import { Dimensions, StyleSheet, View, StatusBar } from 'react-native'
import LottieView from 'lottie-react-native'
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  Easing
} from 'react-native-reanimated'
import useThemeStore from 'store/themeStore'

// Lottie animation assets — light & dark variants
const particles = {
  light: require('assets/animations/hylo-particles-light.json'),
  dark: require('assets/animations/hylo-particles-dark.json')
}
const glyph = {
  light: require('assets/animations/hylo-glyph-light.json'),
  dark: require('assets/animations/hylo-glyph-dark.json')
}

export default function LoadingScreen () {
  const { colorScheme, backgroundColor } = useThemeStore()
  const isDark = colorScheme === 'dark'
  const scheme = isDark ? 'dark' : 'light'

  // Shared value that drives the breathing pulse after the glyph finishes
  const scale = useSharedValue(1)

  const animatedGlyphStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }]
  }))

  const handleGlyphFinish = useCallback((isCancelled) => {
    if (isCancelled) return
    // 12-second full cycle: 6 s up to 1.08, 6 s back down to 1.0
    scale.value = withRepeat(
      withTiming(1.08, { duration: 6000, easing: Easing.inOut(Easing.ease) }),
      -1, // infinite
      true // reverse each iteration
    )
  }, [scale])

  return (
    <View style={[styles.container, { backgroundColor }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />

      {/* Background: looping particles */}
      <LottieView
        source={particles[scheme]}
        autoPlay
        loop
        speed={1}
        resizeMode='cover'
        style={styles.particles}
      />

      {/* Foreground: glyph plays once, then pulses */}
      <Animated.View style={[styles.glyphContainer, animatedGlyphStyle]}>
        <LottieView
          source={glyph[scheme]}
          autoPlay
          loop={false}
          speed={1}
          resizeMode='contain'
          style={styles.glyph}
          onAnimationFinish={handleGlyphFinish}
        />
      </Animated.View>
    </View>
  )
}

const GLYPH_SIZE = 120

// lottie-react-native requires explicit width/height to render at correct size; without them
// the native view can collapse to a few pixels. Use window dimensions so the loading screen
// and particles background always have known size (e.g. when used as an overlay).
const { width: WINDOW_WIDTH, height: WINDOW_HEIGHT } = Dimensions.get('window')

const styles = StyleSheet.create({
  container: {
    flex: 1,
    width: WINDOW_WIDTH,
    height: WINDOW_HEIGHT,
    justifyContent: 'center',
    alignItems: 'center'
  },
  particles: {
    position: 'absolute',
    left: 0,
    top: 0,
    width: WINDOW_WIDTH,
    height: WINDOW_HEIGHT
  },
  glyphContainer: {
    width: GLYPH_SIZE,
    height: GLYPH_SIZE,
    justifyContent: 'center',
    alignItems: 'center'
  },
  glyph: {
    width: GLYPH_SIZE,
    height: GLYPH_SIZE
  }
})
