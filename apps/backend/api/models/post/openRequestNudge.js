/* global bookshelf, Activity */
// D58: requests and offers nobody has answered used to vanish after their first day.
// About three days after posting, the author gets one nudge (in-app, and push where
// their group allows it) asking whether it's still needed or has been met. It opens
// the post with ?nudge=open-request; the post page then offers one-tap
// ?action=still-needed and ?action=met, and answerOpenRequestNudge records the answer.
//
// A post is nudged once: the nudge activity itself is the marker, and it also holds
// the answer (meta.answer, meta.answeredAt).

export const NUDGE_REASON = 'openRequestNudge'
export const NUDGE_POST_TYPES = ['request', 'offer']
// Posts become due this many days after they were created...
export const NUDGE_AFTER_DAYS = 3
// ...and stay due for this long, so a missed daily run still nudges them
export const NUDGE_WINDOW_DAYS = 2

export const NUDGE_ANSWERS = {
  STILL_NEEDED: 'still_needed',
  MET: 'met'
}

const DAY = 24 * 60 * 60 * 1000

const nudgeReasonJson = JSON.stringify([NUDGE_REASON])

/** Restricts an activities query to open-request nudges. */
export const whereNudgeActivity = q => q.whereRaw('activities.meta -> \'reasons\' @> ?::jsonb', [nudgeReasonJson])

/**
 * Requests and offers due a nudge: unfulfilled, active, not past their end time,
 * posted in an active group by an active person, with no comments, and never nudged.
 * @returns {Promise<Array<{ id: string, user_id: string }>>}
 */
export function postsToNudge (now = new Date()) {
  const newest = new Date(now.getTime() - NUDGE_AFTER_DAYS * DAY)
  const oldest = new Date(newest.getTime() - NUDGE_WINDOW_DAYS * DAY)

  return bookshelf.knex('posts')
    .join('users', 'users.id', 'posts.user_id')
    .whereIn('posts.type', NUDGE_POST_TYPES)
    .where('posts.active', true)
    .where('users.active', true)
    .whereNull('posts.fulfilled_at')
    .where(q => q.whereNull('posts.end_time').orWhere('posts.end_time', '>', now))
    .where('posts.created_at', '<=', newest)
    .where('posts.created_at', '>', oldest)
    .whereExists(function () {
      this.select(bookshelf.knex.raw('1'))
        .from('groups_posts')
        .join('groups', 'groups.id', 'groups_posts.group_id')
        .whereRaw('groups_posts.post_id = posts.id')
        .where('groups.active', true)
    })
    .whereNotExists(function () {
      this.select(bookshelf.knex.raw('1'))
        .from('comments')
        .whereRaw('comments.post_id = posts.id')
        .where('comments.active', true)
    })
    .whereNotExists(function () {
      this.select(bookshelf.knex.raw('1'))
        .from('activities')
        .whereRaw('activities.post_id = posts.id')
        .whereRaw('activities.reader_id = posts.user_id')
        .modify(whereNudgeActivity)
    })
    .orderBy('posts.id')
    .select('posts.id', 'posts.user_id')
}

/**
 * The daily job: one nudge per due post, to its author. Each goes out on its own so
 * two posts by the same person stay two notifications.
 * @returns {Promise<number>} how many were sent
 */
export async function sendOpenRequestNudges (now = new Date()) {
  const posts = await postsToNudge(now)
  let sent = 0
  for (const post of posts) {
    await Activity.saveForReasons([{
      reason: NUDGE_REASON,
      reader_id: post.user_id,
      actor_id: post.user_id,
      post_id: post.id
    }])
    sent += 1
  }
  return sent
}

/**
 * Records the author's answer on the post's nudge, if it has one.
 * @returns {Promise<boolean>} whether a nudge was there to record it on
 */
export async function recordNudgeAnswer (post, answer, { at = new Date() } = {}) {
  if (!Object.values(NUDGE_ANSWERS).includes(answer)) throw new Error(`Unknown open request answer: ${answer}`)
  const updated = await bookshelf.knex('activities')
    .where('activities.post_id', post.id)
    .where('activities.reader_id', post.get('user_id'))
    .modify(whereNudgeActivity)
    .update({
      meta: bookshelf.knex.raw('COALESCE(activities.meta, \'{}\'::jsonb) || ?::jsonb', [JSON.stringify({ answer, answeredAt: at.toISOString() })]),
      updated_at: at
    })
  return updated > 0
}

export const isOpenRequestType = post => NUDGE_POST_TYPES.includes(post?.get('type'))
