/*
  Server-side feature flags.

  FEATURE_FLAG_<NAME>=on|off turns a flag on or off. When it is unset, a flag
  listed in ON_OUTSIDE_PRODUCTION is on in the development, test and staging
  environments (named by SENTRY_ENV, falling back to NODE_ENV) and off
  everywhere else, and every other flag is off.
*/

// Add each flag as an exported name constant; list it here to turn it on outside production
const ON_OUTSIDE_PRODUCTION = []
const NON_PRODUCTION_ENVIRONMENTS = ['development', 'test', 'staging']

export function isFeatureEnabled (name) {
  const value = String(process.env[`FEATURE_FLAG_${name}`] || '').trim().toLowerCase()
  if (value === 'on' || value === 'true') return true
  if (value === 'off' || value === 'false') return false

  const environment = process.env.SENTRY_ENV || process.env.NODE_ENV
  return ON_OUTSIDE_PRODUCTION.includes(name) && NON_PRODUCTION_ENVIRONMENTS.includes(environment)
}
