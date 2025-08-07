/**
 * Shared API host utility that works across different environments
 * Supports web (Vite), mobile (react-native-config), and Expo (expo-constants)
 */

let apiHost

// Try different environment configurations
if (typeof process !== 'undefined' && process.env) {
  // Web environment (Vite)
  if (process.env.VITE_API_HOST) {
    apiHost = process.env.VITE_API_HOST
  }
  // Mobile environment (react-native-config)
  else if (process.env.API_HOST) {
    apiHost = process.env.API_HOST
  }
  // Expo environment (expo-constants)
  else if (typeof global !== 'undefined' && global.Expo) {
    try {
      const Constants = require('expo-constants')
      apiHost = Constants.expoConfig?.extra?.apiHost
    } catch (e) {
      // Constants not available
    }
  }
}

// Fallback
if (!apiHost) {
  apiHost = 'http://localhost:3000'
}

if (process.env.NODE_ENV !== 'test') {
  console.log(`API host: ${apiHost}`)
}

export default apiHost 