process.env.NODE_ENV = 'test'
process.env.PUBLIC_URL = ''

const jest = require('jest')
const argv = process.argv.slice(2)

// // Custom config file location
// if (argv.indexOf('--config') < 0) {
//   argv.push('--config', 'config/jest.config.js')
// }

// Watch unless on CI or in coverage mode
if (!process.env.CI && argv.indexOf('--coverage') < 0) {
  argv.push('--watch')
}

// Disable cache if it's causing problems (will make Jest much slower).
// argv.push('--no-cache')

jest.run(argv)
