const path = require('path')
const { getDefaultConfig } = require('expo/metro-config')
const { withNativeWind } = require('nativewind/metro')
const { withSentryConfig } = require('@sentry/react-native/metro')

const projectRoot = __dirname
const monorepoRoot = path.resolve(projectRoot, '../..')

// SDK 52+ auto-configures monorepo resolution — avoid manual watchFolders/nodeModulesPaths
// (they can duplicate react-native/expo and break Expo Go native modules).
const config = getDefaultConfig(projectRoot)

config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName.startsWith('@hylo/presenters/')) {
    const subpath = moduleName.replace('@hylo/presenters/', '')
    const filePath = path.resolve(monorepoRoot, `packages/presenters/dist/cjs/${subpath}.js`)
    const fs = require('fs')
    if (fs.existsSync(filePath)) {
      return { filePath, type: 'sourceFile' }
    }
  }
  return context.resolveRequest(context, moduleName, platform)
}

module.exports = withSentryConfig(withNativeWind(config, {
  input: path.resolve(projectRoot, 'src/style/global.css')
}))
