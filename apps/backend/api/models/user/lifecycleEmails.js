/* global bookshelf, Email, Frontend, Group, Search, User, sails */
// Follow-up emails in a new member's first days (D12), measured against a holdout.
// Runs daily (cron.js).
//
//   Day 2 after someone finishes signing up: "find a group", when they are in no active
//   group yet. It suggests a few open groups (the same list new members see after
//   signup, D4) and links to the Group Explorer.
//   Day 3: "introduce yourself in <group>", when they haven't posted in a group they
//   joined. It links straight to the composer with the group's introduction template,
//   as the join-approved email does.
//
// People are bucketed into LIFECYCLE_EMAILS_HOLDOUT (lib/experiments.js) the first time
// they are eligible for either email, and the holdout gets neither. Each email goes out
// at most once: its users.settings marker is written before it is sent. Only people who
// finished signing up in the last few days are considered, so nobody who signed up
// before this shipped is emailed, and a missed daily run still catches up. People who
// chose "everything except direct" or "everything" (D35), and addresses the email
// provider reported undeliverable (D36), are left out; Email.js checks both again. Each
// email is in the recipient's language. Nothing is sent, and nobody is bucketed, for an
// email whose template isn't uploaded yet (Email.lifecycleTemplatesReady).
import { LIFECYCLE_EMAILS_HOLDOUT, TABLE as EXPERIMENT_TABLE, assign } from '../../../lib/experiments'
import { UNSUBSCRIBE_SCOPE, UNSUBSCRIBE_SCOPE_SETTING } from '../notification/rules/unsubscribeScope'
import { getLocaleStrings } from '../../../lib/i18n/locales'

// Written when someone finishes signing up (User#validateAndSave)
export const SIGNUP_COMPLETED_SETTING = 'signup_completed_at'

export const LIFECYCLE_EMAILS = {
  findGroup: {
    setting: 'lifecycle_find_group_sent_at',
    day: 2,
    clickthrough: 'lifecycle_find_group_email'
  },
  introduce: {
    setting: 'lifecycle_introduce_sent_at',
    day: 3,
    clickthrough: 'lifecycle_introduce_email'
  }
}

// How many days after its day an email can still go out, if a daily run was missed
export const CATCH_UP_DAYS = 2
const BATCH_SIZE = 500
const SUGGESTED_GROUPS = 3
const DAY = 24 * 60 * 60 * 1000

const SIGNED_UP_AT = `coalesce((users.settings->>'${SIGNUP_COMPLETED_SETTING}')::timestamptz, users.created_at)`

const setSetting = (userId, values) => bookshelf.knex('users')
  .where({ id: userId })
  .update({ settings: bookshelf.knex.raw('coalesce(settings, \'{}\'::jsonb) || ?::jsonb', [JSON.stringify(values)]) })

// People whose day for this email has come (and not passed by more than CATCH_UP_DAYS),
// who haven't had it, aren't in the holdout, can be emailed and have finished signup
function candidates (email, now) {
  const { setting, day } = LIFECYCLE_EMAILS[email]
  return bookshelf.knex('users')
    .where('users.active', true)
    .whereNull('users.email_undeliverable_at')
    .whereRaw('coalesce((users.settings->>\'signup_in_progress\')::boolean, false) = false')
    .whereRaw(`${SIGNED_UP_AT} <= ?`, [new Date(now.getTime() - day * DAY)])
    .whereRaw(`${SIGNED_UP_AT} > ?`, [new Date(now.getTime() - (day + CATCH_UP_DAYS) * DAY)])
    .whereRaw('users.settings->>? is null', [setting])
    .whereRaw(`coalesce(users.settings->>'${UNSUBSCRIBE_SCOPE_SETTING}', '') not in (?, ?)`,
      [UNSUBSCRIBE_SCOPE.ALL_BUT_DIRECT, UNSUBSCRIBE_SCOPE.EVERYTHING])
    .whereNotExists(function () {
      this.select(bookshelf.knex.raw(1))
        .from(EXPERIMENT_TABLE)
        .where({ experiment: LIFECYCLE_EMAILS_HOLDOUT.name, subject_type: LIFECYCLE_EMAILS_HOLDOUT.subjectType, variant: 'holdout' })
        .whereRaw(`${EXPERIMENT_TABLE}.subject_id = users.id`)
    })
    .orderBy('users.id')
    .limit(BATCH_SIZE)
}

const inActiveGroup = function () {
  this.select(bookshelf.knex.raw(1))
    .from('group_memberships')
    .join('groups', 'groups.id', 'group_memberships.group_id')
    .whereRaw('group_memberships.user_id = users.id')
    .where('group_memberships.active', true)
    .where('groups.active', true)
}

export function findGroupCandidateIds (now = new Date()) {
  return candidates('findGroup', now).whereNotExists(inActiveGroup).pluck('users.id')
}

export function introduceCandidateIds (now = new Date()) {
  return candidates('introduce', now).whereExists(inActiveGroup).pluck('users.id')
}

// The group to introduce themselves in: the first one they joined (not a space, not
// archived) where they haven't posted anything yet
export async function groupToIntroduceIn (userId) {
  const row = await bookshelf.knex('group_memberships')
    .join('groups', 'groups.id', 'group_memberships.group_id')
    .where('group_memberships.user_id', userId)
    .where('group_memberships.active', true)
    .where('groups.active', true)
    .where(function () {
      this.whereNull('groups.type').orWhere('groups.type', '<>', 'space')
    })
    .whereRaw('groups.status is distinct from ?', ['archived'])
    .whereNotExists(function () {
      this.select(bookshelf.knex.raw(1))
        .from('groups_posts')
        .join('posts', 'posts.id', 'groups_posts.post_id')
        .whereRaw('groups_posts.group_id = groups.id')
        .whereRaw('posts.user_id = group_memberships.user_id')
        .where('posts.active', true)
    })
    .orderBy('group_memberships.created_at', 'asc')
    .orderBy('group_memberships.id', 'asc')
    .first('groups.id')
  return row ? Group.find(row.id) : null
}

const clickthroughFor = (email, user, extra = {}) => '?' + new URLSearchParams({
  ctt: LIFECYCLE_EMAILS[email].clickthrough,
  cti: user.id,
  ...extra
}).toString()

const firstNameOf = user => {
  const name = user.get('name') || ''
  return user.get('first_name') || name.split(' ')[0] || name
}

export async function findGroupData (user) {
  const locale = user.getLocale()
  const clickthroughParams = clickthroughFor('findGroup', user)
  // Open, Explorer-listed groups they could join now (the same list new members get)
  const suggestions = await Search.recommendedGroups({ userId: user.id, limit: SUGGESTED_GROUPS }).fetchAll()
  return {
    subject: getLocaleStrings(locale).lifecycleFindGroupSubject(),
    first_name: firstNameOf(user),
    explore_url: Frontend.appendQueryString(Frontend.Route.groupExplorer(), clickthroughParams),
    email_settings_url: Frontend.Route.notificationsSettings(clickthroughParams, user),
    suggested_groups: suggestions.models.map(group => ({
      name: group.get('name'),
      avatar_url: group.get('avatar_url'),
      member_count: group.get('num_members'),
      url: Frontend.appendQueryString(Frontend.Route.group(group) + '/about', clickthroughParams)
    }))
  }
}

export function introduceData (user, group) {
  const locale = user.getLocale()
  const clickthroughParams = clickthroughFor('introduce', user, { ctcn: group.get('name') })
  // Opens the composer with the group's introduction template (posts-composer)
  const introduceParams = clickthroughFor('introduce', user, {
    ctcn: group.get('name'),
    create: 'post',
    newPostType: 'discussion',
    template: 'intro',
    composerEntry: 'email'
  })
  return {
    subject: getLocaleStrings(locale).lifecycleIntroduceSubject(group.get('name')),
    first_name: firstNameOf(user),
    group_name: group.get('name'),
    group_avatar_url: group.get('avatar_url'),
    group_url: Frontend.Route.groupHome(group) + clickthroughParams,
    introduce_url: Frontend.Route.groupHome(group) + introduceParams,
    email_settings_url: Frontend.Route.notificationsSettings(clickthroughParams, user)
  }
}

// Buckets the person (first eligibility), marks the email, then sends it unless they
// are in the holdout. Resolves true when an email was handed to the provider.
async function sendOne (email, user, buildData, send) {
  if (await assign(LIFECYCLE_EMAILS_HOLDOUT, user.id) === 'holdout') return false
  const data = await buildData()
  if (!data) return false
  // Marked first, so a failure or a second run never sends a second one
  await setSetting(user.id, { [LIFECYCLE_EMAILS[email].setting]: new Date().toISOString() })
  const result = await send({ email: user.get('email'), locale: user.getLocale(), data })
  return !!result && result !== Email.SKIPPED
}

export async function sendLifecycleEmails ({ now = new Date() } = {}) {
  const ready = Email.lifecycleTemplatesReady()
  const sent = { findGroup: 0, introduce: 0 }

  if (ready.findGroup) {
    for (const id of await findGroupCandidateIds(now)) {
      try {
        const user = await User.where({ id }).fetch()
        if (!user) continue
        if (await sendOne('findGroup', user, () => findGroupData(user), opts => Email.sendLifecycleFindGroupEmail(opts))) sent.findGroup += 1
      } catch (err) {
        sails.log.error(`lifecycle emails: could not send the find a group email to user ${id}: ${err.message}`)
      }
    }
  }

  if (ready.introduce) {
    for (const id of await introduceCandidateIds(now)) {
      try {
        const user = await User.where({ id }).fetch()
        if (!user) continue
        const group = await groupToIntroduceIn(user.id)
        // Posted in every group they're in: nothing to ask, and nothing to measure
        if (!group) continue
        if (await sendOne('introduce', user, () => introduceData(user, group), opts => Email.sendLifecycleIntroduceEmail(opts))) sent.introduce += 1
      } catch (err) {
        sails.log.error(`lifecycle emails: could not send the introduce yourself email to user ${id}: ${err.message}`)
      }
    }
  }

  return sent
}
