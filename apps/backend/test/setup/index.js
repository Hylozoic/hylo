/* eslint-disable import/first */
process.env.NODE_ENV = 'test'
process.env.STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || 'sk_test_fake_key_for_testing_purposes'
process.env.STRIPE_API_KEY = process.env.STRIPE_API_KEY || 'sk_test_fake_api_key_for_testing_purposes'

import nock from 'nock'
import './core'
const mock = require('mock-require')
const skiff = require('../../lib/skiff')
const fs = require('fs')
const path = require('path')
const Promise = require('bluebird')
const root = require('root-path')

// Mock Stripe before any modules are loaded
const mockStripe = function (apiKey) {
  return {
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
    }
  }
}

// Set up mock-require to intercept all Stripe imports
mock('stripe', mockStripe)

const TestSetup = function () {
  this.tables = []
  this.initialized = false
}

const setup = new TestSetup()

before(function (done) {
  this.timeout(50000)

  const i18n = require('i18n')
  i18n.configure(require(root('config/i18n')).i18n)
  global.sails = skiff.sails

  skiff.lift({
    log: { level: process.env.LOG_LEVEL || 'warn' },
    silent: true,
    start: function () {
      const { database } = bookshelf.knex.client.connectionSettings
      if (!database.match(/^test|test$/)) {
        const error = new Error(`Invalid test database name "${database}". It must start or end with "test".`)
        return done(error)
      }

      setup.initialized = true

      // add controllers to the global namespace; they would otherwise be excluded
      // since the sails "http" module is not being loaded in the test env
      fs.readdirSync(root('api/controllers')).forEach(function (filename) {
        if (path.extname(filename) === '.js') {
          const modelName = path.basename(filename, '.js')
          global[modelName] = require(root('api/controllers/' + modelName))
        }
      })

      setup.createSchema()
        .then(async () => {
          const cr1 = await CommonRole.forge({ name: 'Coordinator' }).save()
          const cr2 = await CommonRole.forge({ name: 'Moderator' }).save()
          const cr3 = await CommonRole.forge({ name: 'Host' }).save()
          const r1 = await Responsibility.forge({ title: 'Administration', type: 'system' }).save()
          const r2 = await Responsibility.forge({ title: 'Add Members', type: 'system' }).save()
          const r3 = await Responsibility.forge({ title: 'Remove Members', type: 'system' }).save()
          const r4 = await Responsibility.forge({ title: 'Manage Content', type: 'system' }).save()
          await cr1.responsibilities().attach([r1, r2, r3, r4])
          await cr2.responsibilities().attach([r3, r4])
          await cr3.responsibilities().attach([r2])
          await new Tag({ name: 'general' }).save()
          done()
        })
        .catch(done)
    }
  })
})

afterEach(() => nock.cleanAll())

TestSetup.prototype.createSchema = function () {
  if (!this.initialized) throw new Error('not initialized')
  return bookshelf.transaction(trx => {
    return bookshelf.knex.raw('drop schema public cascade').transacting(trx)
      .then(() => bookshelf.knex.raw('create schema public').transacting(trx))
      .then(() => {
        const script = fs.readFileSync(root('migrations/schema.sql')).toString()

        // Remove comment lines
        const cleaned = script.split(/\n/)
          .filter(line => !line.startsWith('--'))
          .join(' ')
          .replace(/\s+/g, ' ')

        // Split by semicolon but preserve dollar-quoted strings
        const commands = []
        let inDollarQuote = false
        let currentCommand = ''

        for (let i = 0; i < cleaned.length; i++) {
          const char = cleaned[i]
          const nextChar = cleaned[i + 1] || ''

          // Check if we're entering or exiting a dollar-quoted string
          if (char === '$' && nextChar === '$') {
            inDollarQuote = !inDollarQuote
            currentCommand += char
            if (nextChar) currentCommand += cleaned[++i]
          } else if (char === ';' && !inDollarQuote) {
            currentCommand += char
            const trimmed = currentCommand.trim()
            if (trimmed) {
              commands.push(trimmed)
            }
            currentCommand = ''
          } else {
            currentCommand += char
          }
        }

        // Add the last command if any
        if (currentCommand.trim()) {
          commands.push(currentCommand.trim())
        }

        return commands.filter(line => line !== '')
      })
      .then(commands => {
        return Promise.map(commands, command => {
          if (command.startsWith('CREATE TABLE')) {
            this.tables.push(command.split(' ')[2])
          }
          return trx.raw(command)
        })
      })
  }) // transaction
}

TestSetup.prototype.clearDb = function () {
  if (!this.initialized) throw new Error('not initialized')
  return bookshelf.knex.transaction(trx => trx.raw('set constraints all deferred')
    .then(() => Promise.map(this.tables, table => { if (!['public.common_roles', 'public.responsibilities', 'public.common_roles_responsibilities', 'public.tags', 'public.platform_agreements'].includes(table)) { return trx.raw('delete from ' + table) } })))
}

module.exports = setup
