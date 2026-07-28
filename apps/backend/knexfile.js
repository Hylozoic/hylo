const merge = require('lodash/merge')
require('dotenv').config()

if (!process.env.DATABASE_URL) {
  throw new Error('process.env.DATABASE_URL must be set')
}

const databaseUrl = new URL(process.env.DATABASE_URL)

const defaults = {
  client: 'pg',
  connection: {
    host: databaseUrl.hostname,
    port: databaseUrl.port || undefined,
    user: decodeURIComponent(databaseUrl.username || 'postgres'),
    // Empty string when URL has no password (e.g. postgresql://postgres@127.0.0.1/db)
    password: databaseUrl.password ? decodeURIComponent(databaseUrl.password) : undefined,
    database: decodeURIComponent(databaseUrl.pathname.replace(/^\//, ''))
  },
  pool: {
    // https://github.com/Vincit/objection.js/issues/1137
    min: 5, // default 2
    max: 30, // default 10
    // https://github.com/knex/knex/issues/2820#issuecomment-481710112
    propagateCreateError: false, // default true (false NOT recommended),
    idleTimeoutMillis: 60000
  },
  migrations: {
    tableName: 'knex_migrations'
  }
}

module.exports = {
  test: defaults,
  development: defaults,
  dummy: Object.assign({}, defaults, { seeds: { directory: './seeds/dummy' } }),
  farmdev: Object.assign({}, defaults, { seeds: { directory: './seeds/farm-dev' } }),
  farmdemo: Object.assign({}, defaults, { seeds: { directory: './seeds/farm-demo' } }),
  staging: defaults,
  production: merge({ connection: { ssl: { rejectUnauthorized: false } } }, defaults),
  docker: Object.assign({},
    defaults,
    {
      connection: Object.assign({},
        defaults.connection,
        { user: 'hylo', password: 'hylo', port: '5300' }
      )
    }
  ),
  createUpdateTrigger: table => `
    CREATE TRIGGER ${table}_updated_at
    BEFORE UPDATE ON ${table}
    FOR EACH ROW
    EXECUTE PROCEDURE on_update_timestamp();
  `,
  dropUpdateTrigger: table => `
    DROP TRIGGER IF EXISTS ${table}_updated_at ON ${table}
  `,
  createUpdateFunction: () => `
    CREATE OR REPLACE FUNCTION on_update_timestamp()
    RETURNS trigger AS $$
    BEGIN
      NEW.updated_at = now();
      RETURN NEW;
    END;
    $$ language 'plpgsql';
  `,
  dropUpdateFunction: () => `
    DROP FUNCTION IF EXISTS on_update_timestamp()
  `
}
