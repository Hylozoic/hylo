/* global bookshelf */

/**
 * A short factual summary of a group for the AI that designs and suggests
 * views: what the group says it is for, how big it is, what kinds of posts it
 * has and how recently, the titles of its latest posts and coming events, and
 * the views already in its menu.
 *
 * Only titles and counts leave the server, never post bodies, comments or
 * anything about individual members. Chats are left out: they are
 * conversation, not content a page would be built around.
 */

const RECENT_DAYS = 90
const MAX_RECENT_POSTS = 25
const MAX_UPCOMING_EVENTS = 8
const MAX_TEXT = 1500
const MAX_TITLE = 120
const CONTENT_TYPES = ['discussion', 'event', 'offer', 'project', 'proposal', 'request', 'resource']

function plainText (html, max = MAX_TEXT) {
  return String(html || '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max)
}

const daysBetween = (from, to) => Math.round((to.getTime() - from.getTime()) / 86400000)

export async function buildGroupDigest (group, now = new Date()) {
  const knex = bookshelf.knex
  const groupId = group.id
  const since = new Date(now.getTime() - RECENT_DAYS * 86400000)

  const groupPosts = () => knex('posts')
    .join('groups_posts', 'groups_posts.post_id', 'posts.id')
    .where('groups_posts.group_id', groupId)
    .where('posts.active', true)
    .whereIn('posts.type', CONTENT_TYPES)

  const [totals, recentTotals, recentPosts, upcomingEvents, openCounts, views] = await Promise.all([
    groupPosts().select('posts.type').count('* as count').groupBy('posts.type'),
    groupPosts().where('posts.created_at', '>', since).select('posts.type').count('* as count').groupBy('posts.type'),
    groupPosts().orderBy('posts.created_at', 'desc').limit(MAX_RECENT_POSTS)
      .select('posts.id', 'posts.type', 'posts.name', 'posts.num_comments', 'posts.created_at'),
    groupPosts().where('posts.type', 'event').where('posts.start_time', '>', now).orderBy('posts.start_time', 'asc')
      .limit(MAX_UPCOMING_EVENTS).select('posts.id', 'posts.name', 'posts.start_time'),
    groupPosts().whereIn('posts.type', ['request', 'offer']).whereNull('posts.fulfilled_at')
      .select('posts.type').count('* as count').groupBy('posts.type'),
    knex('group_views').where('group_id', groupId).whereNotNull('order').orderBy('order').select('type', 'name')
  ])

  const counts = rows => Object.fromEntries(rows.map(row => [row.type, Number(row.count)]))

  return {
    name: group.get('name'),
    purpose: plainText(group.get('purpose')),
    description: plainText(group.get('description')),
    location: plainText(group.get('location'), 120),
    memberCount: Number(group.get('num_members')) || 0,
    postCounts: counts(totals),
    recentPostCounts: counts(recentTotals),
    recentDays: RECENT_DAYS,
    openCounts: counts(openCounts),
    recentPosts: recentPosts.map(post => ({
      id: String(post.id),
      type: post.type,
      title: plainText(post.name, MAX_TITLE),
      comments: Number(post.num_comments) || 0,
      daysAgo: Math.max(0, daysBetween(new Date(post.created_at), now))
    })),
    upcomingEvents: upcomingEvents.map(event => ({
      id: String(event.id),
      title: plainText(event.name, MAX_TITLE),
      inDays: Math.max(0, daysBetween(now, new Date(event.start_time)))
    })),
    views: views.map(view => ({ type: view.type, name: plainText(view.name, 60) }))
  }
}

const countsLine = counts => {
  const entries = Object.entries(counts || {}).sort((a, b) => b[1] - a[1])
  return entries.length > 0 ? entries.map(([type, count]) => `${count} ${type}`).join(', ') : 'none'
}

/**
 * The digest as plain text for a prompt.
 */
export function formatGroupDigest (digest) {
  if (!digest) return ''
  const lines = [
    `Group name: ${digest.name || '(unnamed)'}`,
    `Purpose: ${digest.purpose || '(none written)'}`,
    `Description: ${digest.description || '(none written)'}`,
    digest.location ? `Location: ${digest.location}` : null,
    `Members: ${digest.memberCount}`,
    `Posts in total: ${countsLine(digest.postCounts)}`,
    `Posts in the last ${digest.recentDays} days: ${countsLine(digest.recentPostCounts)}`,
    `Open requests and offers: ${countsLine(digest.openCounts)}`,
    // Built-in views are stored with a translation key for a name ('view-events'); their type says it all
    `Views already in the menu: ${(digest.views || []).map(view => view.name && !view.name.startsWith('view-') ? `${view.name} (${view.type})` : view.type).join(', ') || 'none'}`,
    '',
    'Upcoming events:',
    ...((digest.upcomingEvents || []).length > 0
      ? digest.upcomingEvents.map(event => `- #${event.id} ${event.title} (in ${event.inDays} days)`)
      : ['- none']),
    '',
    'Most recent posts, newest first (id and title only):',
    ...((digest.recentPosts || []).length > 0
      ? digest.recentPosts.map(post => `- #${post.id} [${post.type}] ${post.title} (${post.daysAgo} days ago, ${post.comments} comments)`)
      : ['- none'])
  ]
  return lines.filter(line => line !== null).join('\n')
}

/**
 * The ids of the posts named in a digest, which the AI may show parts of.
 */
export function digestPostIds (digest) {
  return [...new Set([...(digest?.recentPosts || []), ...(digest?.upcomingEvents || [])].map(post => String(post.id)).filter(Boolean))]
}

/**
 * Which of `ids` are active posts in the group, as strings. Chats are left out:
 * they are not standalone posts a page can show.
 */
export async function postIdsInGroup (groupId, ids) {
  const wanted = [...new Set((ids || []).map(String))].filter(id => /^[1-9][0-9]{0,18}$/.test(id))
  if (wanted.length === 0) return []
  const rows = await bookshelf.knex('posts')
    .join('groups_posts', 'groups_posts.post_id', 'posts.id')
    .where('groups_posts.group_id', groupId)
    .where('posts.active', true)
    .whereIn('posts.type', CONTENT_TYPES)
    .whereIn('posts.id', wanted)
    .select('posts.id')
  return rows.map(row => String(row.id))
}

/**
 * What the AI is told about posts the steward picked to build a page around:
 * more than the digest gives, since the page is about them. Posts outside the
 * group are left out.
 */
export async function describePickedPosts (groupId, ids) {
  const inGroup = await postIdsInGroup(groupId, ids)
  if (inGroup.length === 0) return []
  const rows = await bookshelf.knex('posts')
    .whereIn('id', inGroup)
    .select('id', 'type', 'name', 'description', 'start_time', 'end_time', 'location', 'num_comments')
  // Keep the steward's order
  return inGroup.map(id => rows.find(row => String(row.id) === id)).filter(Boolean).map(row => ({
    id: String(row.id),
    type: row.type,
    title: plainText(row.name, MAX_TITLE),
    details: plainText(row.description, 600),
    startTime: row.start_time ? new Date(row.start_time).toISOString() : null,
    endTime: row.end_time ? new Date(row.end_time).toISOString() : null,
    location: plainText(row.location, 160),
    comments: Number(row.num_comments) || 0
  }))
}

/**
 * Picked posts as plain text for a prompt.
 */
export function formatPickedPosts (posts) {
  if (!posts || posts.length === 0) return ''
  return posts.map(post => [
    `- #${post.id} [${post.type}] ${post.title}`,
    post.startTime ? `  Starts: ${post.startTime}${post.endTime ? `, ends: ${post.endTime}` : ''}` : null,
    post.location ? `  Where: ${post.location}` : null,
    post.details ? `  Details: ${post.details}` : null,
    `  Comments so far: ${post.comments}`
  ].filter(Boolean).join('\n')).join('\n')
}
