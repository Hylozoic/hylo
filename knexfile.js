require('dotenv').load()

if (!process.env.DATABASE_URL) {
  throw new Error('process.env.DATABASE_URL must be set')
}

const url = require('url').parse(process.env.DATABASE_URL)
var user, password
if (url.auth) {
  const i = url.auth.indexOf(':')
  user = url.auth.slice(0, i)
  password = url.auth.slice(i + 1)
}

const defaults = {
  client: 'pg',
  connection: {
    host: url.hostname,
    port: url.port,
    user: user,
    password: password,
    database: url.path.substring(1)
  },
  migrations: {
    tableName: 'knex_migrations'
  }
}

module.exports = {
  test: defaults,
  development: defaults,
  staging: defaults,
  production: defaults
}
