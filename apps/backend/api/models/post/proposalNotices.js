/* global Activity, Post, bookshelf */
// Proposal notices (D46). There is deliberately no 'voting opened' broadcast.
//
//   proposalVote         to the author as votes come in: grouped, in-app only
//                        (notification/socialNotices)
//   proposalClosingSoon  once, in-app and push, to members of the proposal's groups who
//                        haven't voted, in the last CLOSING_SOON_HOURS of voting
//   proposalClosed       when voting ends: 'voting closed: <winning option>' to voters,
//                        and to the author a prompt to record the outcome
//   proposalOutcome      once, when the author first records the outcome, to voters
//
// The every-10-minutes cron runs sendProposalNotices right after
// Post.updateProposalStatuses, which returns the proposals it moved to 'completed'.
// One-off notices carry a group_key, so a proposal is never told twice.
import { uniq } from 'lodash'
import sentry from '../../../lib/sentry'
import { groupKeyFor, sentNoticeKeys } from '../notification/grouping'

export const CLOSING_SOON_HOURS = 24

const OUTCOME_MAX_LENGTH = 140

const sameId = (a, b) => a !== null && a !== undefined && String(a) === String(b)

async function voterIds (postId) {
  const rows = await bookshelf.knex('proposal_votes').where('post_id', postId).distinct('user_id')
  return rows.map(row => String(row.user_id))
}

async function activeMemberIds (groupIds) {
  if (groupIds.length === 0) return []
  const rows = await bookshelf.knex('group_memberships')
    .join('users', 'users.id', 'group_memberships.user_id')
    .whereIn('group_memberships.group_id', groupIds)
    .where('group_memberships.active', true)
    .where('users.active', true)
    .distinct('group_memberships.user_id')
  return rows.map(row => String(row.user_id))
}

// The option with the most votes, or a tie, or nothing when no one voted.
export async function votingResult (postId) {
  const rows = await bookshelf.knex('proposal_options')
    .leftJoin('proposal_votes', 'proposal_votes.option_id', 'proposal_options.id')
    .where('proposal_options.post_id', postId)
    .groupBy('proposal_options.id', 'proposal_options.text', 'proposal_options.emoji')
    .select('proposal_options.id', 'proposal_options.text', 'proposal_options.emoji')
    .count('proposal_votes.id as votes')
  const tallied = rows
    .map(row => ({ ...row, votes: Number(row.votes) }))
    .sort((a, b) => b.votes - a.votes)
  const [top, next] = tallied
  if (!top || top.votes === 0) return { winningOption: null, tie: false }
  if (next && next.votes === top.votes) return { winningOption: null, tie: true }
  return { winningOption: [top.emoji, top.text].filter(Boolean).join(' '), tie: false }
}

const noticeFor = (post, reason, readerId, extra = {}) => ({
  reader_id: readerId,
  actor_id: post.get('user_id'),
  post_id: post.id,
  reason,
  group_key: groupKeyFor(reason, { postId: post.id }),
  ...extra
})

// Proposals in their last CLOSING_SOON_HOURS of voting, and at least halfway through,
// so a short vote is not announced the moment it opens.
export async function sendClosingSoonNotices ({ now = new Date() } = {}) {
  const until = new Date(now.getTime() + CLOSING_SOON_HOURS * 60 * 60 * 1000)
  const posts = await Post.query(q => {
    q.where({ type: Post.Type.PROPOSAL, active: true, proposal_status: Post.Proposal_Status.VOTING })
    q.whereNotNull('start_time')
    q.where('end_time', '>', now)
    q.where('end_time', '<=', until)
    q.whereRaw('? >= start_time + (end_time - start_time) / 2', [now])
  }).fetchAll({ withRelated: ['groups'] })

  const keys = posts.map(post => groupKeyFor('proposalClosingSoon', { postId: post.id }))
  const sent = await sentNoticeKeys(keys)

  let notified = 0
  for (const post of posts.models) {
    if (sent.has(groupKeyFor('proposalClosingSoon', { postId: post.id }))) continue
    try {
      const voted = new Set(await voterIds(post.id))
      const readers = (await activeMemberIds(post.relations.groups.map(group => group.id)))
        .filter(id => !voted.has(id) && !sameId(id, post.get('user_id')))
      if (readers.length === 0) continue
      await Activity.saveForReasons(readers.map(readerId =>
        noticeFor(post, 'proposalClosingSoon', readerId, { meta: { endTime: post.get('end_time') } })))
      notified += readers.length
    } catch (err) {
      sentry.error(err, null, { postId: post.id })
    }
  }
  return notified
}

// Voting ended for these proposals: voters hear the result, the author is asked to
// record the outcome.
export async function notifyProposalsClosed (postIds = []) {
  if (postIds.length === 0) return 0
  const keys = postIds.map(postId => groupKeyFor('proposalClosed', { postId }))
  const sent = await sentNoticeKeys(keys)
  let notified = 0
  for (const postId of postIds) {
    if (sent.has(groupKeyFor('proposalClosed', { postId }))) continue
    try {
      const post = await Post.find(postId)
      if (!post) continue
      const result = await votingResult(post.id)
      const authorId = post.get('user_id')
      const readers = (await voterIds(post.id)).filter(id => !sameId(id, authorId))
      const activities = readers.map(readerId => noticeFor(post, 'proposalClosed', readerId, { meta: result }))
      if (authorId) {
        activities.push(noticeFor(post, 'proposalClosed', authorId, { meta: { ...result, forAuthor: true } }))
      }
      if (activities.length === 0) continue
      await Activity.saveForReasons(activities)
      notified += activities.length
    } catch (err) {
      sentry.error(err, null, { postId })
    }
  }
  return notified
}

// The author recorded an outcome: tell the voters, the first time only (later edits
// to the outcome are quiet).
export async function notifyProposalOutcome ({ post, userId, outcome }) {
  try {
    const text = String(outcome || '').trim()
    if (!post || !text || !post.isProposal()) return 0
    const key = groupKeyFor('proposalOutcome', { postId: post.id })
    if ((await sentNoticeKeys([key])).has(key)) return 0
    const readers = uniq(await voterIds(post.id)).filter(id => !sameId(id, userId))
    if (readers.length === 0) return 0
    const summary = text.length > OUTCOME_MAX_LENGTH ? text.slice(0, OUTCOME_MAX_LENGTH - 1).trimEnd() + '…' : text
    await Activity.saveForReasons(readers.map(readerId => ({
      ...noticeFor(post, 'proposalOutcome', readerId, { meta: { outcome: summary } }),
      actor_id: userId
    })))
    return readers.length
  } catch (err) {
    sentry.error(err, null, { postId: post?.id })
    return 0
  }
}

export async function sendProposalNotices ({ completedIds = [], now } = {}) {
  const closed = await notifyProposalsClosed(completedIds)
  const closingSoon = await sendClosingSoonNotices({ now })
  return { closed, closingSoon }
}
