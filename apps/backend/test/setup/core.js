process.env.NODE_ENV = 'test'

// Set test environment variables if not already set
process.env.INBOUND_EMAIL_SALT = process.env.INBOUND_EMAIL_SALT || 'FFFFAAAA123456789'
process.env.INBOUND_EMAIL_DOMAIN = process.env.INBOUND_EMAIL_DOMAIN || 'inbound-staging.hylo.com'
process.env.PLAY_APP_SECRET = process.env.PLAY_APP_SECRET || 'quxgrault12345678'
process.env.PUSH_NOTIFICATIONS_ENABLED = process.env.PUSH_NOTIFICATIONS_ENABLED || 'true'
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

// Create a global Stripe mock that can be used by test modules (`new Stripe(key)` yields this singleton).
// Webhook tests stub `global.__stripeWebhookConstructEvent` (see StripeController.test.js).
const mockStripeClient = {
  charges: {
    create: () => Promise.resolve({})
  },
  customers: {
    create: () => Promise.resolve({})
  },
  accounts: {
    create: async () => ({}),
    retrieve: async () => ({}),
    update: async () => ({})
  },
  accountLinks: {
    create: async () => ({})
  },
  products: {
    create: async () => ({}),
    update: async () => ({}),
    list: async () => ({})
  },
  prices: {
    create: async () => ({}),
    retrieve: async () => ({})
  },
  checkout: {
    sessions: {
      create: async () => ({}),
      retrieve: async () => ({})
    }
  },
  subscriptions: {
    retrieve: async () => ({})
  },
  invoices: {
    retrieve: async () => ({})
  },
  paymentIntents: {
    retrieve: async () => ({})
  },
  webhooks: {
    constructEvent: (payload, signature, secret) => {
      if (typeof global.__stripeWebhookConstructEvent === 'function') {
        return global.__stripeWebhookConstructEvent(payload, signature, secret)
      }
      throw new Error('stripe.webhooks.constructEvent is not stubbed for this test')
    }
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
