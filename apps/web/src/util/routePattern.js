/**
 * Turns an address into the route pattern sent with the "Page Viewed" event,
 * e.g. /groups/garden-club/post/123 → /groups/:groupSlug/post/:postId.
 *
 * It never returns a slug, id, token, name or query string: a segment is kept
 * only when it is one of the app's page names below, and every other segment
 * becomes a placeholder. Addresses outside the app's known top-level sections
 * become GENERIC_ROUTE.
 *
 * The web app nests its <Routes> with no central table, so these lists are
 * kept by hand (from AuthLayoutRouter, NonAuthLayoutRouter, RootRouter,
 * SpaceContent and the settings tabs). A page missing here is reported with
 * :id in place of its name, which is safe, just less specific.
 */

export const GENERIC_ROUTE = '/*'

const MAX_SEGMENTS = 8

// First segments of the app's own pages
const ROOTS = new Set([
  'all', 'create-group', 'groups', 'h', 'login', 'management', 'members', 'messages', 'my',
  'notifications', 'oauth', 'post', 'public', 'reset-password', 'search', 'settings', 'signup',
  'themes', 'welcome'
])

// Page names, kept as they are
const PAGE_NAMES = new Set([
  'about', 'account', 'add-location', 'agreements', 'all', 'all-topics', 'all-views', 'announcements',
  'appearance', 'banners', 'blocked-users', 'cancel', 'chat', 'collection', 'comment', 'comments',
  'consent', 'content-access', 'create', 'create-group', 'custom', 'delete', 'deleted', 'details', 'discussions',
  'drafts', 'edit', 'edit-profile', 'email-testers', 'events', 'explore', 'export', 'failure', 'finish',
  'funding-round-submissions', 'funding-rounds', 'group', 'groups', 'h', 'import', 'interactions',
  'invitation', 'invitations', 'invite', 'join', 'locale', 'login', 'management', 'manage-round', 'map',
  'members', 'mentions', 'messages', 'moderation', 'more-spaces', 'my', 'new', 'new-public-groups', 'notifications', 'oauth',
  'offerings', 'page', 'paid-content', 'payment', 'post', 'posts', 'privacy', 'projects', 'proposals',
  'public', 'recommended-groups', 'related-groups', 'relationships', 'reports', 'requests', 'requests-and-offers', 'reset-password',
  'resources', 'responsibilities', 'roles', 'safety', 'saved-posts', 'saved-searches', 'search', 'settings',
  'signup', 'site', 'space-collection', 'spaces', 'staging', 'stream', 'stripe-analytics',
  'subscriptions', 'success', 'themes', 'topics', 'track-actions', 'tracks', 'transactions',
  'upload-photo', 'use-invitation', 'verify-email', 'welcome', 'without-administrator'
])

// The segment after one of these is someone's data, so it's always a placeholder
const PARAM_AFTER = {
  chat: ':topicName',
  collection: ':viewId',
  comment: ':commentId',
  comments: ':commentId',
  consent: ':uid',
  custom: ':viewId',
  group: ':groupSlug',
  join: ':accessCode',
  login: ':uid',
  page: ':viewId',
  post: ':postId',
  'space-collection': ':viewId',
  spaces: ':spaceSlug',
  topics: ':topicName'
}

// Like PARAM_AFTER, except that a page name there is kept (/members/create, /messages/new)
const PARAM_OR_PAGE_AFTER = {
  'funding-rounds': ':fundingRoundId',
  members: ':personId',
  messages: ':messageThreadId',
  offerings: ':offeringId',
  tracks: ':trackId'
}

export default function routePattern (pathname) {
  if (typeof pathname !== 'string') return GENERIC_ROUTE
  const segments = pathname.split(/[?#]/)[0].split('/').filter(Boolean).map(s => s.toLowerCase())
  if (segments.length === 0) return '/'
  if (!ROOTS.has(segments[0])) return GENERIC_ROUTE

  const pattern = []
  for (let i = 0; i < segments.length; i++) {
    if (i === MAX_SEGMENTS) {
      pattern.push('*')
      break
    }
    const segment = segments[i]
    // What was emitted for the previous segment, so a slug that happens to be
    // a page name (a group called "post") can't change how the rest is read
    const previous = i > 0 ? pattern[i - 1] : null

    if (i === 1 && previous === 'groups') {
      pattern.push(':groupSlug')
    } else if (previous && PARAM_AFTER[previous]) {
      pattern.push(PARAM_AFTER[previous])
    } else if (previous && PARAM_OR_PAGE_AFTER[previous]) {
      pattern.push(PAGE_NAMES.has(segment) ? segment : PARAM_OR_PAGE_AFTER[previous])
    } else {
      pattern.push(PAGE_NAMES.has(segment) ? segment : ':id')
    }
  }
  return '/' + pattern.join('/')
}
