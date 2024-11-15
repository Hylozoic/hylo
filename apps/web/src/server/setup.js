// this file sets up an environment that allows us to do server-side rendering
// without webpack.
import dotenv from 'dotenv-safe'
import postcssScss from 'postcss-scss'
import postcssNested from 'postcss-nested'
import postcssModulesResolvePath from 'postcss-modules-resolve-path'
import cssModulesRequireHook from 'css-modules-require-hook'
import rootPath from 'root-path'

const startTime = new Date().getTime()

export default startTime

dotenv.load()

// Configuration files are already ES5 so they doesn't get transpiled or copied
// anywhere. We can always require them relative to the app's root path.
const { resolveApp, babelConfigFile } = require(rootPath('config/paths'))
const sharedConfig = require(rootPath('config/webpack.config.shared'))
const cssModulesConfig = require(babelConfigFile)()
  .env
  .production
  .plugins.find(x => x[0] === 'react-css-modules')[1]

// handle CSS imports and generate class names the same way that webpack does
cssModulesRequireHook({
  extensions: ['.css', '.scss'],
  generateScopedName: sharedConfig.cssLoader.options.localIdentName,
  processorOpts: {
    parser: postcssScss.parse
  },
  prepend: [
    postcssNested,
    postcssModulesResolvePath({
      paths: cssModulesConfig.searchPaths.map(resolveApp)
    })
  ]
})
