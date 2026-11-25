import { materializeTimestamps } from './helpers'

const loaders = {
  en: () => import('./en/index.js')
}

/**
 * Load sandbox seed for a locale, materialize relative timestamps, fall back to en.
 */
export async function loadSandboxSeed (locale = 'en') {
  const load = loaders[locale] || loaders.en
  const mod = await load()
  const raw = mod.buildEnSeed()
  return relinkPosts(materializeTimestamps(raw))
}

/**
 * Synchronous load when caller already has the locale module (tests).
 */
export function loadSandboxSeedSync (buildFn) {
  return relinkPosts(materializeTimestamps(buildFn()))
}

/**
 * materializeTimestamps copies every object, so each post list ends up with its own copy of
 * a post. Point the lists back at the posts in `posts.byId` so a change to a post (a task
 * moved on the board, a new comment) shows everywhere the post is listed.
 */
function relinkPosts (seed) {
  const byId = seed?.posts?.byId
  if (!byId) return seed
  const relink = list => list.map(post => byId[post.id] || post)
  for (const [key, list] of Object.entries(seed.posts)) {
    if (Array.isArray(list)) seed.posts[key] = relink(list)
  }
  if (Array.isArray(seed.fundingRound?.submissions?.items)) {
    seed.fundingRound.submissions.items = relink(seed.fundingRound.submissions.items)
  }
  return seed
}

export { materializeTimestamps } from './helpers'
export {
  MAIN_GROUP_MEMBER_COUNT,
  MAIN_GROUP_SLUG,
  PLACEHOLDER_COPY,
  PLACEHOLDER_NAME,
  SIMPLE_GROUP_SLUG,
  STAFF_GROUP_SLUG
} from './constants'
