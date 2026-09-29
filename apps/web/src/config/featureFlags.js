export const PROJECT_CONTRIBUTIONS = 'PROJECT_CONTRIBUTIONS'
// Members sending invitations: the "Who can add new members?" controls
export const MEMBER_INVITES = 'MEMBER_INVITES'
// Members inviting existing Hylo people from the people search. Off everywhere
// unless VITE_FEATURE_FLAG_MEMBER_INVITE_PICKER is 'on', and only with MEMBER_INVITES
export const MEMBER_INVITE_PICKER = 'MEMBER_INVITE_PICKER'

// Flags that default to 'on' in development, test and staging, and to off in production
const ON_OUTSIDE_PRODUCTION = [MEMBER_INVITES]
const NON_PRODUCTION_ENVIRONMENTS = ['development', 'test', 'staging']

// Staging runs a production build, so it is told apart by the environment name its error reports use
const environment = () => import.meta.env.VITE_SENTRY_ENV || import.meta.env.MODE

// VITE_FEATURE_FLAG_<KEY> ('on', 'testing' or 'off') overrides a flag's default
const featureFlag = key =>
  import.meta.env[`VITE_FEATURE_FLAG_${key}`] ||
  process.env['FEATURE_FLAG_' + key] ||
  (ON_OUTSIDE_PRODUCTION.includes(key) && NON_PRODUCTION_ENVIRONMENTS.includes(environment()) ? 'on' : undefined)

export default featureFlag
