process.env.NODE_ENV = 'test'

// Set test environment variables if not already set
process.env.INBOUND_EMAIL_SALT = process.env.INBOUND_EMAIL_SALT || 'FFFFAAAA123456789'
process.env.INBOUND_EMAIL_DOMAIN = process.env.INBOUND_EMAIL_DOMAIN || 'inbound-staging.hylo.com'
process.env.PLAY_APP_SECRET = process.env.PLAY_APP_SECRET || 'quxgrault12345678'
process.env.EMAIL_NOTIFICATIONS_ENABLED = process.env.EMAIL_NOTIFICATIONS_ENABLED || 'true'
process.env.PUSH_NOTIFICATIONS_TESTING_ENABLED = process.env.PUSH_NOTIFICATIONS_TESTING_ENABLED || 'true'
process.env.HYLO_TESTER_IDS = process.env.HYLO_TESTER_IDS || '1'

// just set up the test globals, not the test database

const chai = require('chai')

chai.use(require('chai-things'))
chai.use(require('chai-spies'))
chai.use(require('chai-as-promised'))
chai.use(require('chai-datetime'))

global.spy = chai.spy
global.expect = chai.expect

// Create a global Stripe mock that can be used by test modules
const mockStripeClient = {
  charges: {
    create: () => Promise.resolve({})
  },
  customers: {
    create: () => Promise.resolve({})
  }
}

// Mock require.cache for 'stripe' module
const Module = require('module')
const originalRequire = Module.prototype.require
Module.prototype.require = function (id) {
  if (id === 'stripe') {
    return function () {
      return mockStripeClient
    }
  }
  return originalRequire.apply(this, arguments)
}
