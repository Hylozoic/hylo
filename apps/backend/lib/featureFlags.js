/*
  Server-side feature flags.

  FEATURE_FLAG_<NAME>=on|off turns a flag on or off. When it is unset, a flag
  listed in ON_OUTSIDE_PRODUCTION is on in the development, test and staging
  environments (named by SENTRY_ENV, falling back to NODE_ENV) and off
  everywhere else, and every other flag is off.
*/

// Members sending invitations: the 'everyone' and 'roles' invite policies,
// and the limited invite access they give
export const MEMBER_INVITES = 'MEMBER_INVITES'

// Members with limited invite access inviting existing Hylo people from the
// people search (in-app notification only). Works only while MEMBER_INVITES is
// on too, and is off everywhere until FEATURE_FLAG_MEMBER_INVITE_PICKER=on.
export const MEMBER_INVITE_PICKER = 'MEMBER_INVITE_PICKER'

const ON_OUTSIDE_PRODUCTION = [MEMBER_INVITES]
const NON_PRODUCTION_ENVIRONMENTS = ['development', 'test', 'staging']

export function isFeatureEnabled (name) {
  const value = String(process.env[`FEATURE_FLAG_${name}`] || '').trim().toLowerCase()
  if (value === 'on' || value === 'true') return true
  if (value === 'off' || value === 'false') return false

  const environment = process.env.SENTRY_ENV || process.env.NODE_ENV
  return ON_OUTSIDE_PRODUCTION.includes(name) && NON_PRODUCTION_ENVIRONMENTS.includes(environment)
}
