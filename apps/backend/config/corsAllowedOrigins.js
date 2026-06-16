/**
 * Browser origins trusted for credentialed CORS (e.g. GraphQL with cookies).
 * Must not reflect arbitrary Origin when Access-Control-Allow-Credentials is true.
 * Optional extra origins: set CORS_ALLOWED_ORIGINS (comma-separated) in the environment.
 */

const HYLO_TRUSTED_BROWSER_ORIGINS = [
  'https://www.hylo.com',
  'https://hylo.com',
  'https://api.hylo.com',
  'https://staging.hylo.com',
  'https://node1.hylo.com',
  'https://review.hylo.com',
  'https://api-staging.hylo.com',
  'https://api-review.hylo.com',
  'http://localhost:9000',
  'https://localhost:9000',
  'http://localhost:3000',
  'https://localhost:3000',
  'http://localhost:3001',
  'https://localhost:3001',
  'http://localhost:4321',
  'https://localhost:4321'
]

/** Builds the Set of allowed Origin header values (base list plus CORS_ALLOWED_ORIGINS). */
function buildAllowedOriginsSet () {
  const set = new Set(HYLO_TRUSTED_BROWSER_ORIGINS)
  const extra = process.env.CORS_ALLOWED_ORIGINS
  if (!extra) return set
  extra.split(',').forEach(part => {
    const t = part.trim()
    if (t) set.add(t)
  })
  return set
}

const graphqlCorsAllowedOriginsSet = buildAllowedOriginsSet()

/** Comma-separated allowOrigins for sails.config.security.cors (same list as GraphQL). */
function hyloCorsAllowOriginsCommaSeparated () {
  return [...buildAllowedOriginsSet()].join(',')
}

/**
 * Dynamic `origin` option for the `cors` package on GraphQL when credentials are enabled.
 * Allows non-browser requests with no Origin header; rejects unknown origins (no reflection).
 */
function graphqlCorsOrigin (origin, callback) {
  if (!origin) return callback(null, true)
  if (graphqlCorsAllowedOriginsSet.has(origin)) return callback(null, true)
  callback(null, false)
}

module.exports = {
  HYLO_TRUSTED_BROWSER_ORIGINS,
  graphqlCorsOrigin,
  hyloCorsAllowOriginsCommaSeparated
}
