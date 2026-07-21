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

// Mock Stripe before any modules are loaded (must support `new Stripe(key, opts)` — see stripe-node v17)
function TestStripeClient () {
  if (!(this instanceof TestStripeClient)) {
    return new TestStripeClient()
  }
  this.accounts = {
    create: async () => ({}),
    retrieve: async () => ({}),
    update: async () => ({})
  }
  this.accountLinks = {
    create: async () => ({})
  }
  this.products = {
    create: async () => ({}),
    update: async () => ({}),
    list: async () => ({})
  }
  this.prices = {
    create: async () => ({}),
    retrieve: async () => ({})
  }
  this.checkout = {
    sessions: {
      create: async () => ({}),
      retrieve: async () => ({})
    }
  }
  this.subscriptions = {
    retrieve: async () => ({})
  }
  this.invoices = {
    retrieve: async () => ({})
  }
  this.paymentIntents = {
    retrieve: async () => ({})
  }
  this.webhooks = {
    constructEvent: () => {
      throw new Error('stripe.webhooks.constructEvent is not stubbed for this test')
    }
  }
}

// Set up mock-require to intercept all Stripe imports
mock('stripe', TestStripeClient)

const TestSetup = function () {
  this.tables = []
  this.initialized = false
}

const setup = new TestSetup()

setup.restoreDefaultStripeMock = () => {
  mock.stop('stripe')
  mock('stripe', TestStripeClient)
}

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
          const systemResponsibilities = [
            'Administration',
            'Add Members',
            'Remove Members',
            'Manage Content',
            'Manage Tracks',
            'Manage Rounds'
          ]
          for (const title of systemResponsibilities) {
            await Responsibility.forge({ title, type: 'system' }).save()
          }
          await new Tag({ name: 'general' }).save()
          done()
        })
        .catch(done)
    }
  })
})

afterEach(() => nock.cleanAll())

// Split SQL statements on semicolons while ignoring semicolons inside
// dollar-quoted function/procedure bodies (e.g. $$ ... $$, $tag$ ... $tag$)
// and inside single-quoted string literals.
function splitSqlStatements (sql) {
  const statements = []
  let current = ''
  let i = 0
  let dollarTag = null
  let inSingleQuote = false

  while (i < sql.length) {
    const ch = sql[i]

    if (inSingleQuote) {
      current += ch
      if (ch === "'") {
        if (sql[i + 1] === "'") {
          current += sql[i + 1]
          i += 2
          continue
        }
        inSingleQuote = false
      }
      i += 1
      continue
    }

    if (!dollarTag && ch === "'") {
      inSingleQuote = true
      current += ch
      i += 1
      continue
    }

    if (!dollarTag && ch === '$') {
      const m = sql.slice(i).match(/^\$[A-Za-z_][A-Za-z0-9_]*\$/) || (sql.slice(i, i + 2) === '$$' ? ['$$'] : null)
      if (m) {
        dollarTag = m[0]
        current += dollarTag
        i += dollarTag.length
        continue
      }
    }

    if (dollarTag && sql.startsWith(dollarTag, i)) {
      current += dollarTag
      i += dollarTag.length
      dollarTag = null
      continue
    }

    if (!dollarTag && ch === ';') {
      const stmt = current.trim()
      if (stmt) statements.push(stmt)
      current = ''
      i += 1
      continue
    }

    current += ch
    i += 1
  }

  const last = current.trim()
  if (last) statements.push(last)
  return statements
}

TestSetup.prototype.createSchema = function () {
  if (!this.initialized) throw new Error('not initialized')
  return bookshelf.transaction(trx => {
    return bookshelf.knex.raw('drop schema public cascade').transacting(trx)
      .then(() => bookshelf.knex.raw('create schema public').transacting(trx))
      .then(() => {
        const script = fs.readFileSync(root('migrations/schema.sql')).toString()
        const cleaned = script.split(/\n/)
          .filter(line => !line.startsWith('--') && !line.startsWith('\\'))
          .join('\n')
        return splitSqlStatements(cleaned)
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
    .then(() => {
      // Delete from user_scopes first to avoid foreign key constraint violations
      return trx.raw('delete from public.user_scopes')
    })
    .then(() => Promise.map(this.tables, table => { if (!['public.common_roles', 'public.responsibilities', 'public.common_roles_responsibilities', 'public.tags', 'public.platform_agreements'].includes(table)) { return trx.raw('delete from ' + table) } })))
}

module.exports = setup
