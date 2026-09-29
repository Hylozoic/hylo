/* global bookshelf */
// Minimal first-party experiment bucketing (S31).
//
// A subject's variant comes from a hash of the experiment name and the subject, so it
// is stable and needs no lookup. The first assignment is recorded in
// experiment_assignments, and from then on the stored variant wins, even if the
// percentages change later. Assignments stay in Hylo's database: nothing goes to a
// third party (D2), and there are no exposure events. Outcomes are measured from the
// database by joining experiment_assignments to what people did.
//
// Register experiments here as named constants, so the packages that run them only
// import them. Percentages across an experiment's variants add up to 100.
import crypto from 'crypto'

export const TABLE = 'experiment_assignments'

// D12: day-2 "find a group" and day-3 "introduce yourself" emails for new members,
// measured against a holdout that gets neither.
export const LIFECYCLE_EMAILS_HOLDOUT = {
  name: 'lifecycle_emails_holdout',
  subjectType: 'user',
  variants: [
    { name: 'holdout', percent: 10 },
    { name: 'emails', percent: 90 }
  ]
}

// D15: tell authors when people react to their posts and comments (in-app, plus at
// most one grouped push per item per hour), measuring whether they post again.
export const REACTION_NOTICES = {
  name: 'reaction_notices',
  subjectType: 'user',
  variants: [
    { name: 'control', percent: 50 },
    { name: 'notices', percent: 50 }
  ]
}

// D49: nudge Moderators and Hosts when a newcomer's first post has no response after
// 24 hours, measuring whether the newcomer posts a second time. The subject is the
// newcomer.
export const FIRST_POST_NUDGE = {
  name: 'first_post_nudge',
  subjectType: 'user',
  variants: [
    { name: 'control', percent: 50 },
    { name: 'nudge', percent: 50 }
  ]
}

export const EXPERIMENTS = [LIFECYCLE_EMAILS_HOLDOUT, REACTION_NOTICES, FIRST_POST_NUDGE]

const BUCKETS = 10000

// A number in 0..9999 from the experiment and subject, the same every time.
export function bucketOf (experiment, subjectId) {
  const key = `${experiment.name}:${experiment.subjectType}:${subjectId}`
  const hash = crypto.createHash('sha256').update(key).digest()
  return hash.readUInt32BE(0) % BUCKETS
}

// The variant the hash gives, without touching the database.
export function variantByHash (experiment, subjectId) {
  const bucket = bucketOf(experiment, subjectId)
  let upTo = 0
  for (const variant of experiment.variants) {
    upTo += variant.percent * (BUCKETS / 100)
    if (bucket < upTo) return variant.name
  }
  return experiment.variants[experiment.variants.length - 1].name
}

// The stored variant for this subject, or null if they have not been assigned yet.
export async function storedVariant (experiment, subjectId, { transacting } = {}) {
  const query = bookshelf.knex(TABLE)
    .where({ experiment: experiment.name, subject_type: experiment.subjectType, subject_id: subjectId })
    .first('variant')
  if (transacting) query.transacting(transacting)
  const row = await query
  return row ? row.variant : null
}

// Assigns the subject on first call and records it; later calls return the stored
// variant. Safe to call concurrently: the unique index keeps one row.
export async function assign (experiment, subjectId, { transacting } = {}) {
  if (subjectId == null) throw new Error('assign needs a subject id')
  const insert = bookshelf.knex.raw(`
    INSERT INTO ${TABLE} (experiment, subject_type, subject_id, variant, assigned_at)
    VALUES (?, ?, ?, ?, now())
    ON CONFLICT (experiment, subject_type, subject_id) DO NOTHING
  `, [experiment.name, experiment.subjectType, subjectId, variantByHash(experiment, subjectId)])
  await (transacting ? insert.transacting(transacting) : insert)
  return storedVariant(experiment, subjectId, { transacting })
}

export async function isInVariant (experiment, subjectId, variantName, opts) {
  return (await assign(experiment, subjectId, opts)) === variantName
}
