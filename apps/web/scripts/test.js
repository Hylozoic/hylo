process.env.NODE_ENV = 'test'
process.env.PUBLIC_URL = ''

// Load environment variables from .env file. Suppress warnings using silent
// if this file is missing. dotenv will never modify any environment variables
// that have already been set.
// https://github.com/motdotla/dotenv
import dotenv from 'dotenv'
dotenv.config({ silent: true })

import jest from 'jest'
const argv = process.argv.slice(2)

// Custom config file location
if (argv.indexOf('--config') < 0) {
  argv.push('--config', 'config/jest.config.js')
}

// Watch unless on CI or in coverage mode
if (!process.env.CI && argv.indexOf('--coverage') < 0) {
  argv.push('--watch')
}

// Disable cache if it's causing problems (will make Jest much slower).
// argv.push('--no-cache')

argv.push('--runInBand') // Needed to speed up test run times in docker and CI envs

jest.run(argv)
