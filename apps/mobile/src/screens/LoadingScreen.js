import React, { useCallback } from 'react'
import { StyleSheet, View, StatusBar, useWindowDimensions } from 'react-native'
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
  const { width, height } = useWindowDimensions()
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

  // Both JSONs are authored at 390×844 (full-screen artboard). Rendering them in a
  // small box (e.g. 120×120) makes the native view scale/clip the whole composition into
  // a tiny area — looks like a few pixels. Match the view size to the screen so the
  // composition displays at the intended scale (same as design).
  const fullScreen = { width, height }

  return (
    <View style={[styles.container, { backgroundColor }, fullScreen]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />

      {/* Background: looping particles — full screen */}
      <LottieView
        source={particles[scheme]}
        autoPlay
        loop
        speed={1}
        resizeMode='cover'
        style={[styles.fill, fullScreen]}
      />

      {/* Foreground: glyph is also a full-screen composition; pulse wraps full screen */}
      <Animated.View style={[styles.fill, fullScreen, styles.glyphLayer, animatedGlyphStyle]}>
        <LottieView
          source={glyph[scheme]}
          autoPlay
          loop={false}
          speed={1}
          resizeMode='contain'
          style={[styles.fill, fullScreen]}
          onAnimationFinish={handleGlyphFinish}
        />
      </Animated.View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    justifyContent: 'center',
    alignItems: 'center'
  },
  fill: {
    position: 'absolute',
    left: 0,
    top: 0
  },
  // Glyph draws above particles
  glyphLayer: {
    zIndex: 1
  }
})
