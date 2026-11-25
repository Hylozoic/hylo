/*
  Web feature flags: the flag names, how a flag is read, and the checks built on them.

  VITE_FEATURE_FLAG_<KEY> ('on', 'testing' or 'off') sets a flag. When it is unset, a flag listed in
  ON_OUTSIDE_PRODUCTION is on in development, test and staging builds, and every other flag is off.
*/

// Hylo Pro billing: the group Billing settings tab
export const HYLO_PRO = 'HYLO_PRO'

// Flags that default to 'on' in development, test and staging, and to off in production
const ON_OUTSIDE_PRODUCTION = [HYLO_PRO]
const NON_PRODUCTION_ENVIRONMENTS = ['development', 'test', 'staging']

// Staging runs a production build, so it is told apart by the environment name its error reports use
const environment = () => import.meta.env.VITE_SENTRY_ENV || import.meta.env.MODE

// The flag's value: VITE_FEATURE_FLAG_<KEY>, then FEATURE_FLAG_<KEY> (tests), then its default
const featureFlag = key =>
  import.meta.env[`VITE_FEATURE_FLAG_${key}`] ||
  process.env['FEATURE_FLAG_' + key] ||
  (ON_OUTSIDE_PRODUCTION.includes(key) && NON_PRODUCTION_ENVIRONMENTS.includes(environment()) ? 'on' : undefined)

export default featureFlag

/**
 * Whether a flag is on. 'testing' turns it on only for testers (pass isTester; Me#hasFeature
 * passes whether the current user is in HYLO_TESTER_IDS).
 */
export function hasFeature (key, isTester = false) {
  if (!key) throw new Error("Can't call hasFeature without a key")

  switch (featureFlag(key)) {
    case 'on':
      return true
    case 'testing':
      return isTester
    default:
      return false
  }
}

/**
 * Whether to offer Hylo Pro billing (the group Billing settings tab) to `me`, the current user
 * (useSelector(getMe)). Hylo staff (isAdmin: the people who can open Management) always see it, so
 * they can try Pro in their own groups while the HYLO_PRO flag hides it from everyone else. The
 * flag only hides the web UI; the backend's Pro mutations and Group.proBilling are not gated.
 */
export function isHyloProEnabled (me) {
  return hasFeature(HYLO_PRO) || !!me?.isAdmin
}
