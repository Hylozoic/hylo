process.env.NODE_ENV = 'test'

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
