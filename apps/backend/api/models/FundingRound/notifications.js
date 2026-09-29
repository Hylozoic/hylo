/* eslint-disable camelcase */
/* global FundingRound, Activity, Responsibility, bookshelf, Group */
import { DateTime } from 'luxon'

/**
 * Each submission's result when a round ends (D77): the tokens it received and its
 * rank among the round's submissions (ties share a rank). Tokens are counted as the
 * round's results show them (every allocation to the submission).
 */
export const submissionResults = async (round) => {
  const rows = await bookshelf.knex('groups_posts')
    .join('posts', 'posts.id', 'groups_posts.post_id')
    .leftJoin('posts_users', 'posts_users.post_id', 'posts.id')
    .where('groups_posts.group_id', round.get('group_id'))
    .where('posts.type', 'submission')
    .where('posts.active', true)
    .groupBy('posts.id', 'posts.user_id', 'posts.name')
    .select('posts.id', 'posts.user_id', 'posts.name')
    .select(bookshelf.knex.raw('COALESCE(SUM(posts_users.tokens_allocated_to), 0) AS tokens'))
  const results = rows.map(row => ({
    postId: String(row.id),
    userId: String(row.user_id),
    title: row.name || '',
    tokens: Number(row.tokens) || 0
  }))
  return results.map(result => ({
    ...result,
    rank: 1 + results.filter(other => other.tokens > result.tokens).length
  }))
}

// What a submitter is told about their own submissions when the round completes. When
// the round hides its final results from participants, they hear that the stewards
// will follow up instead, with no numbers.
const resultMetaFor = (round, results, submitterId) => {
  const own = results.filter(result => result.userId === String(submitterId))
  if (own.length === 0) return {}
  if (round.get('hide_final_results_from_participants')) return { resultsHidden: true }
  return {
    submissionResults: own.map(({ postId, title, tokens, rank }) => ({ postId, title, tokens, rank })),
    submissionCount: results.length,
    tokenType: round.get('token_type') || null
  }
}

/**
 * Check for phase transitions and send notifications
 */
export const sendPhaseTransitionNotifications = async ({ roundId, phase }) => {
  const round = await FundingRound.find(roundId)
  if (!round) return
  const participants = await round.users().fetch()
  const completed = phase === FundingRound.PHASES.COMPLETED
  const results = completed ? await submissionResults(round) : []
  // Submitters hear their own result even if they have left the round
  const readerIds = [...new Set([
    ...participants.map(user => String(user.id)),
    ...results.map(result => result.userId)
  ])]
  const activities = readerIds.map(readerId => ({
    reason: 'fundingRoundPhaseTransition:' + phase,
    reader_id: readerId,
    group_id: round.get('group_id'),
    funding_round_id: round.id,
    meta: { phase, ...(completed ? resultMetaFor(round, results, readerId) : {}) }
  }))
  if (activities.length > 0) {
    await Activity.saveForReasons(activities)
  }
  return activities.length
}

// Voting reminders go only to participants who still have tokens to allocate (D77)
const participantIdsWithTokensLeft = async (round) => {
  const ids = await bookshelf.knex('group_memberships')
    .where({ group_id: round.get('group_id'), active: true })
    .whereRaw("COALESCE((settings->>'tokensRemaining')::numeric, 0) > 0")
    .pluck('user_id')
  return new Set(ids.map(String))
}

/**
 * Send reminder notifications 3 days and 1 day before deadlines
 */
export const sendReminderNotifications = async () => {
  const now = DateTime.now()
  const threeDaysFromNow = now.plus({ days: 3 })
  const oneDayFromNow = now.plus({ days: 1 })
  const threeDaysFromNowStart = threeDaysFromNow.startOf('day')
  const threeDaysFromNowEnd = threeDaysFromNow.endOf('day')
  const oneDayFromNowStart = oneDayFromNow.startOf('day')
  const oneDayFromNowEnd = oneDayFromNow.endOf('day')

  let count = 0

  // Check for submissions closing in 3 days
  const submissionsClosing3Days = await FundingRound.query(q => {
    q.where('deactivated_at', null)
    q.whereNotNull('submissions_close_at')
    q.whereBetween('submissions_close_at', [threeDaysFromNowStart.toJSDate(), threeDaysFromNowEnd.toJSDate()])
    q.join('groups', 'groups.id', 'funding_rounds.group_id')
    q.whereIn('groups.status', Group.PUBLISHED_STATUSES)
    q.where('groups.active', true)
  }).fetchAll({ withRelated: ['group', 'users'] })

  for (const round of submissionsClosing3Days.models) {
    // Check if we've already sent a 3-day reminder
    const existingReminder = await Activity.query(q => {
      q.where('funding_round_id', round.id)
      q.where('meta', '@>', JSON.stringify({ reminderType: 'submissionsClosing3Days' }))
      q.where('created_at', '>', now.minus({ days: 2 }).toJSDate())
    }).fetch()

    if (!existingReminder) {
      let participants = await round.users().fetch()

      // Filter to only users who can submit if submitter roles are specified
      const submitterRoles = round.get('submitter_roles')
      if (submitterRoles && submitterRoles.length > 0) {
        participants = await Promise.all(
          participants.map(async user => ({
            user,
            canSubmit: await round.canUserSubmit(user.id)
          }))
        )
        participants = participants
          .filter(({ canSubmit }) => canSubmit)
          .map(({ user }) => user)
      }

      const activities = participants.map(user => ({
        reason: 'fundingRoundReminder',
        reader_id: user.id,
        group_id: round.get('group_id'),
        funding_round_id: round.id,
        meta: { reminderType: 'submissionsClosing3Days' }
      }))

      if (activities.length > 0) {
        await Activity.saveForReasons(activities)
        count++
      }
    }
  }

  // Check for submissions closing in 1 day
  const submissionsClosing1Day = await FundingRound.query(q => {
    q.where('deactivated_at', null)
    q.whereNotNull('submissions_close_at')
    q.whereBetween('submissions_close_at', [oneDayFromNowStart.toJSDate(), oneDayFromNowEnd.toJSDate()])
    q.join('groups', 'groups.id', 'funding_rounds.group_id')
    q.whereIn('groups.status', Group.PUBLISHED_STATUSES)
    q.where('groups.active', true)
  }).fetchAll({ withRelated: ['group', 'users'] })

  for (const round of submissionsClosing1Day.models) {
    // Check if we've already sent a 1-day reminder
    const existingReminder = await Activity.query(q => {
      q.where('funding_round_id', round.id)
      q.where('meta', '@>', JSON.stringify({ reminderType: 'submissionsClosing1Day' }))
      q.where('created_at', '>', now.minus({ hours: 12 }).toJSDate())
    }).fetch()

    if (!existingReminder) {
      let participants = await round.users().fetch()

      // Filter to only users who can submit if submitter roles are specified
      const submitterRoles = round.get('submitter_roles')
      if (submitterRoles && submitterRoles.length > 0) {
        participants = await Promise.all(
          participants.map(async user => ({
            user,
            canSubmit: await round.canUserSubmit(user.id)
          }))
        )
        participants = participants
          .filter(({ canSubmit }) => canSubmit)
          .map(({ user }) => user)
      }

      // Get all submission post IDs for this round
      const submissions = await round.submissions().fetch()
      const submitterIds = submissions.map(post => post.get('user_id'))

      // Filter to only users who haven't submitted yet
      const usersWithoutSubmissions = participants.filter(user =>
        !submitterIds.includes(user.id)
      )

      const activities = usersWithoutSubmissions.map(user => ({
        reason: 'fundingRoundReminder',
        reader_id: user.id,
        group_id: round.get('group_id'),
        funding_round_id: round.id,
        meta: { reminderType: 'submissionsClosing1Day' }
      }))

      if (activities.length > 0) {
        await Activity.saveForReasons(activities)
        count++
      }
    }
  }

  // Check for voting closing in 3 days
  const votingClosing3Days = await FundingRound.query(q => {
    q.where('deactivated_at', null)
    q.whereNotNull('voting_closes_at')
    q.whereBetween('voting_closes_at', [threeDaysFromNowStart.toJSDate(), threeDaysFromNowEnd.toJSDate()])
    q.join('groups', 'groups.id', 'funding_rounds.group_id')
    q.whereIn('groups.status', Group.PUBLISHED_STATUSES)
    q.where('groups.active', true)
  }).fetchAll({ withRelated: ['group', 'users'] })

  for (const round of votingClosing3Days.models) {
    // Check if we've already sent a 3-day reminder
    const existingReminder = await Activity.query(q => {
      q.where('funding_round_id', round.id)
      q.where('meta', '@>', JSON.stringify({ reminderType: 'votingClosing3Days' }))
      q.where('created_at', '>', now.minus({ days: 2 }).toJSDate())
    }).fetch()

    if (!existingReminder) {
      let participants = await round.users().fetch()

      // Filter to only users who can vote if voter roles are specified
      const voterRoles = round.get('voter_roles')
      if (voterRoles && voterRoles.length > 0) {
        participants = await Promise.all(
          participants.map(async user => ({
            user,
            canVote: await round.canUserVote(user.id)
          }))
        )
        participants = participants
          .filter(({ canVote }) => canVote)
          .map(({ user }) => user)
      }

      const withTokensLeft = await participantIdsWithTokensLeft(round)
      const activities = participants
        .filter(user => withTokensLeft.has(String(user.id)))
        .map(user => ({
          reason: 'fundingRoundReminder',
          reader_id: user.id,
          group_id: round.get('group_id'),
          funding_round_id: round.id,
          meta: { reminderType: 'votingClosing3Days' }
        }))

      if (activities.length > 0) {
        await Activity.saveForReasons(activities)
        count++
      }
    }
  }

  // Check for voting closing in 1 day
  const votingClosing1Day = await FundingRound.query(q => {
    q.where('deactivated_at', null)
    q.whereNotNull('voting_closes_at')
    q.whereBetween('voting_closes_at', [oneDayFromNowStart.toJSDate(), oneDayFromNowEnd.toJSDate()])
    q.join('groups', 'groups.id', 'funding_rounds.group_id')
    q.whereIn('groups.status', Group.PUBLISHED_STATUSES)
    q.where('groups.active', true)
  }).fetchAll({ withRelated: ['group', 'users'] })

  for (const round of votingClosing1Day.models) {
    // Check if we've already sent a 1-day reminder
    const existingReminder = await Activity.query(q => {
      q.where('funding_round_id', round.id)
      q.where('meta', '@>', JSON.stringify({ reminderType: 'votingClosing1Day' }))
      q.where('created_at', '>', now.minus({ hours: 12 }).toJSDate())
    }).fetch()

    if (!existingReminder) {
      let participants = await round.users().fetch()

      // Filter to only users who can vote if voter roles are specified
      const voterRoles = round.get('voter_roles')
      if (voterRoles && voterRoles.length > 0) {
        participants = await Promise.all(
          participants.map(async user => ({
            user,
            canVote: await round.canUserVote(user.id)
          }))
        )
        participants = participants
          .filter(({ canVote }) => canVote)
          .map(({ user }) => user)
      }

      const withTokensLeft = await participantIdsWithTokensLeft(round)
      const activities = participants
        .filter(user => withTokensLeft.has(String(user.id)))
        .map(user => ({
          reason: 'fundingRoundReminder',
          reader_id: user.id,
          group_id: round.get('group_id'),
          funding_round_id: round.id,
          meta: { reminderType: 'votingClosing1Day' }
        }))

      if (activities.length > 0) {
        await Activity.saveForReasons(activities)
        count++
      }
    }
  }

  return count
}

// Background task to notify stewards of new submission
export const notifyStewardsOfSubmission = async ({ fundingRoundId, postId, userId }) => {
  const fundingRound = await FundingRound.find(fundingRoundId)
  if (!fundingRound) return

  const group = await fundingRound.group().fetch()
  const adminResponsibility = await Responsibility.where({ title: Responsibility.constants.RESP_ADMINISTRATION }).fetch()
  const stewards = await group.membersWithResponsibilities([adminResponsibility.id]).fetch()
  const stewardIds = stewards.pluck('id')

  const activities = stewardIds
    .filter(stewardId => stewardId !== userId) // Don't notify the submitter
    .map(stewardId => ({
      reason: 'fundingRoundNewSubmission',
      actor_id: userId,
      group_id: group.id,
      reader_id: stewardId,
      funding_round_id: fundingRoundId,
      post_id: postId
    }))

  if (activities.length > 0) {
    await Activity.saveForReasons(activities)
  }
}
