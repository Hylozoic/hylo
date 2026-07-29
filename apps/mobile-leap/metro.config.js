const path = require('path')
const { getSentryExpoConfig } = require('@sentry/react-native/metro')
const { withNativeWind } = require('nativewind/metro')

const projectRoot = __dirname
const monorepoRoot = path.resolve(projectRoot, '../..')

// Expo + Metro 0.83+: use Sentry's Expo config (debug ID via asset plugin), not
// withSentryConfig's customSerializer — release Gradle bundles hit undefined bundle code.
const config = getSentryExpoConfig(projectRoot)

const previousResolveRequest = config.resolver?.resolveRequest
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName.startsWith('@hylo/presenters/')) {
    const subpath = moduleName.replace('@hylo/presenters/', '')
    const filePath = path.resolve(monorepoRoot, `packages/presenters/dist/cjs/${subpath}.js`)
    const fs = require('fs')
    if (fs.existsSync(filePath)) {
      return { filePath, type: 'sourceFile' }
    }
  }
  if (previousResolveRequest) {
    return previousResolveRequest(context, moduleName, platform)
  }
  return context.resolveRequest(context, moduleName, platform)
}

module.exports = withNativeWind(config, {
  input: path.resolve(projectRoot, 'src/style/global.css')
})
