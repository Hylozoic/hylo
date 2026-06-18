export const AUTH_ROOT_SCREEN_NAME = 'AuthRoot'
export const NON_AUTH_ROOT_SCREEN_NAME = 'NonAuthRoot'

export const unknownRouteMatch = __DEV__ ? { ':unmatchedBasePath(.*)': 'Unknown' } : {}

export const routingConfig: Record<string, string | ((search: string) => void)> = {
  '/login': `${NON_AUTH_ROOT_SCREEN_NAME}/Login`,
  '/reset-password': `${NON_AUTH_ROOT_SCREEN_NAME}/ForgotPassword`,
  '/signup/:step?': `${NON_AUTH_ROOT_SCREEN_NAME}/Signup/Signup Intro`,
  '/noo/login/(jwt|token)': 'LoginByTokenHandler',
  '/oauth/consent/:uid': `${NON_AUTH_ROOT_SCREEN_NAME}/Login`,
  '/oauth/login/:uid': `${NON_AUTH_ROOT_SCREEN_NAME}/Login`,
  '/:context(groups)/:groupSlug/join/:accessCode': 'JoinGroup',
  '/h/use-invitation': 'JoinGroup',
  ':path(.*)': `${AUTH_ROOT_SCREEN_NAME}/Main`
}

export const initialRouteNamesConfig: Record<string, string> = {}

export const DEFAULT_APP_HOST = 'https://www.hylo.com'

export const prefixes = [
  DEFAULT_APP_HOST,
  'https://staging.hylo.com',
  'hyloapp://www.hylo.com',
  'hyloapp://staging.hylo.com',
  'hyloapp://hylo.com',
  'hyloapp://'
]

export const staticPages = [
  '',
  '/help',
  '/help/markdown',
  '/about',
  '/about/careers',
  '/about/contact',
  '/about/team',
  '/evolve',
  '/invite-expired',
  '/subscribe',
  '/styleguide',
  '/team',
  '/terms',
  '/terms/privacy',
  '/privacy',
  '/newapp'
]
