import { GraphQLError } from 'graphql'

/*
 * Explorer review: which Public groups appear in the Group Explorer.
 *
 * A new Public top-level group (or one that switches to Public) waits in the
 * "New public groups" list in Management until a Hylo admin approves it.
 * Approving sets groups.allow_in_public, which lists the group in the Explorer.
 * allow_in_public also lets a group's posts appear in the public stream, so
 * approving and unlisting change both until that flag is split.
 *
 * The one-time review of groups that were already Public (see migration
 * 20261004000000_group_explorer_review) puts unlisted groups that pass the
 * quality bar into the same list, and asks admins to keep or unlist listed
 * groups that no longer pass it.
 */

// Quality bar for the recommendation shown next to each group
export const MIN_MEMBERS = 3
export const ACTIVITY_WINDOW_DAYS = 90

// Post types that are system notices, not something a member posted
export const NON_ACTIVITY_POST_TYPES = ['welcome', 'chat_activity']

export const ExplorerStatus = {
  PENDING: 'pending',
  APPROVED: 'approved',
  DENIED: 'denied',
  KEEP_OR_UNLIST: 'keep_or_unlist',
  KEPT: 'kept',
  UNLISTED: 'unlisted'
}

const DECISIONS = {
  approve: { status: ExplorerStatus.APPROVED, allowInPublic: true },
  deny: { status: ExplorerStatus.DENIED, allowInPublic: false },
  keep: { status: ExplorerStatus.KEPT, allowInPublic: true },
  unlist: { status: ExplorerStatus.UNLISTED, allowInPublic: false }
}

const MAX_LISTED = 500
const PUBLIC_VISIBILITY = 2

function isTopLevel (type) {
  return type !== 'space'
}

/**
 * The explorer_status a group starts with: new Public top-level groups wait for review.
 * @param {{ visibility?: number, type?: string }} attrs the new group's attributes
 * @returns {string|null}
 */
export function explorerStatusForNewGroup (attrs = {}) {
  return Number(attrs.visibility) === PUBLIC_VISIBILITY && isTopLevel(attrs.type)
    ? ExplorerStatus.PENDING
    : null
}

/**
 * The explorer_status to set when a group's visibility changes, or undefined to leave it.
 * A top-level group that becomes Public and isn't listed goes back into the review list,
 * including groups that were denied or unlisted before.
 * @param {object} group the group model, with the new visibility already set
 * @param {number} previousVisibility visibility before this update
 * @returns {string|undefined}
 */
export function explorerStatusOnVisibilityChange (group, previousVisibility) {
  const becomingPublic = Number(previousVisibility) !== PUBLIC_VISIBILITY &&
    Number(group.get('visibility')) === PUBLIC_VISIBILITY
  if (!becomingPublic || !isTopLevel(group.get('type')) || group.get('allow_in_public')) return undefined
  if (group.get('explorer_status') === ExplorerStatus.PENDING) return undefined
  return ExplorerStatus.PENDING
}

async function requireSuperAdmin (userId) {
  if (!(await Admin.isSuperAdmin(userId))) {
    throw new GraphQLError('Unauthorized: Admin access required')
  }
}

/** Member count, posts in the activity window and latest post, per group. */
function withQuality (qb) {
  const knex = bookshelf.knex
  const nonActivityTypes = NON_ACTIVITY_POST_TYPES.map(() => '?').join(', ')
  qb.select(
    'groups.id',
    'groups.name',
    'groups.slug',
    'groups.avatar_url',
    'groups.description',
    'groups.created_at',
    'groups.allow_in_public',
    'groups.explorer_status',
    knex.raw('(SELECT count(*) FROM group_memberships gm WHERE gm.group_id = groups.id AND gm.active = true)::int AS member_count'),
    knex.raw(`(
      SELECT count(*)
      FROM groups_posts gp
      JOIN posts p ON p.id = gp.post_id
      WHERE gp.group_id = groups.id
        AND p.active = true
        AND p.type NOT IN (${nonActivityTypes})
        AND p.created_at >= now() - make_interval(days => ?)
    )::int AS recent_post_count`, [...NON_ACTIVITY_POST_TYPES, ACTIVITY_WINDOW_DAYS]),
    knex.raw(`(
      SELECT max(p.created_at)
      FROM groups_posts gp
      JOIN posts p ON p.id = gp.post_id
      WHERE gp.group_id = groups.id
        AND p.active = true
        AND p.type NOT IN (${nonActivityTypes})
    ) AS last_post_at`, NON_ACTIVITY_POST_TYPES)
  )
  return qb
}

export function meetsBar ({ memberCount, recentPostCount }) {
  return memberCount >= MIN_MEMBERS && recentPostCount > 0
}

function present (row) {
  const item = {
    id: row.id,
    name: row.name,
    slug: row.slug,
    avatarUrl: row.avatar_url,
    description: row.description,
    createdAt: row.created_at,
    status: row.explorer_status,
    allowInPublic: !!row.allow_in_public,
    memberCount: Number(row.member_count) || 0,
    recentPostCount: Number(row.recent_post_count) || 0,
    lastPostAt: row.last_post_at
  }
  item.meetsBar = meetsBar(item)
  return item
}

function reviewableGroups (status) {
  const qb = bookshelf.knex('groups')
    .where('groups.active', true)
    .where('groups.visibility', PUBLIC_VISIBILITY)
    .where('groups.explorer_status', status)
    .where(q => q.whereNull('groups.type').orWhere('groups.type', '<>', 'space'))
    .orderBy('groups.created_at', 'desc')
    .limit(MAX_LISTED)
  if (status === ExplorerStatus.KEEP_OR_UNLIST) qb.where('groups.allow_in_public', true)
  return withQuality(qb)
}

/**
 * Groups waiting for review, for the Management page (Hylo admins only).
 */
export async function explorerReviewList (userId) {
  await requireSuperAdmin(userId)
  const [pending, keepOrUnlist] = await Promise.all([
    reviewableGroups(ExplorerStatus.PENDING),
    reviewableGroups(ExplorerStatus.KEEP_OR_UNLIST)
  ])
  return {
    pending: pending.map(present),
    keepOrUnlist: keepOrUnlist.map(present),
    minMembers: MIN_MEMBERS,
    activityWindowDays: ACTIVITY_WINDOW_DAYS
  }
}

/**
 * Approve, deny, keep or unlist a group (Hylo admins only).
 * @param {string} decision one of approve, deny, keep, unlist
 */
export async function reviewExplorerGroup (userId, groupId, decision) {
  await requireSuperAdmin(userId)
  const outcome = DECISIONS[decision]
  if (!outcome) throw new GraphQLError(`Unknown review decision "${decision}"`)

  const group = await Group.find(groupId)
  if (!group || !isTopLevel(group.get('type'))) throw new GraphQLError('Group not found')

  await bookshelf.knex('groups').where('id', group.id).update({
    allow_in_public: outcome.allowInPublic,
    explorer_status: outcome.status,
    explorer_reviewed_at: new Date(),
    explorer_reviewed_by_id: userId
  })

  const [row] = await withQuality(bookshelf.knex('groups').where('groups.id', group.id))
  return present(row)
}
