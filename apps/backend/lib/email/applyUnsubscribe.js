/* global bookshelf, Group, GroupMembership */
// What a one-click unsubscribe (D34), or a spam complaint about an email (D36), switches
// off. Each email names a descriptor in lib/email/emailTypes.js:
//
//   group_digest               that group's email digest becomes Never, which also stops
//                              its hourly chat digests (D72). For a space, the parent
//                              group's membership, since spaces follow it. For the unified
//                              digest (one email for all groups, no single group), every
//                              membership on that digest's frequency becomes Never: the
//                              person asked to stop that email, and switching the unified
//                              digest off would send them one digest per group instead.
//                              A weekly unified digest that also carried daily groups
//                              slowed down for being away (slowedDaily, D9) covers those
//                              daily memberships too.
//   group_post_email           that group's email (membership sendEmail), for a space its
//                              parent group's
//   comment_email              comment email (comment_notifications: both -> push, email -> none)
//   dm_email                   direct message email (dm_notifications, the same way)
//   membership_setting:<key>   that membership setting becomes false, for the group named,
//                              or for every membership when no group is named
//   settings_page              nothing; the person chooses on the settings page
//
// Returns { applied, changed, groupId }: applied is false when nothing could be switched
// off (settings_page, or no membership), changed is false when it was already off.

export const EMAIL_OFF = { both: 'push', email: 'none' }

// The membership whose settings govern this group: a space's parent group membership
async function governingMembership (userId, groupId) {
  const group = await Group.where({ id: groupId }).fetch()
  if (!group) return null
  const parentId = group.get('type') === 'space' ? group.get('parent_id') : null
  if (parentId) {
    const parentMembership = await GroupMembership.forPair(userId, parentId).fetch()
    if (parentMembership) return parentMembership
  }
  return GroupMembership.forPair(userId, groupId).fetch()
}

async function setMembershipSetting (userId, groupId, key, value) {
  const membership = await governingMembership(userId, groupId)
  if (!membership) return { applied: false, changed: false }
  if (membership.getSetting(key) === value) return { applied: true, changed: false, groupId: membership.get('group_id') }
  await membership.addSetting({ [key]: value }, true)
  return { applied: true, changed: true, groupId: membership.get('group_id') }
}

// The digest frequencies a unified digest's one-click covers
const unifiedFrequencies = ({ frequency, slowedDaily }) =>
  slowedDaily && frequency === 'weekly' ? ['weekly', 'daily'] : [frequency]

async function setEveryMembership (userId, key, value, onlyWhere = null) {
  const query = bookshelf.knex('group_memberships')
    .where({ user_id: userId, active: true })
    .whereRaw('coalesce(settings->>?, \'\') <> ?', [key, String(value)])
  if (onlyWhere) query.whereIn(bookshelf.knex.raw('settings->>?', [onlyWhere.key]), onlyWhere.values)
  const count = await query.update({ settings: bookshelf.knex.raw('settings || ?::jsonb', [JSON.stringify({ [key]: value })]) })
  return { applied: true, changed: count > 0 }
}

async function turnOffUserEmailSetting (user, key) {
  const current = user.getSetting(key) || 'both'
  const next = EMAIL_OFF[current]
  if (!next) return { applied: true, changed: false }
  await user.addSetting({ [key]: next }, true)
  return { applied: true, changed: true }
}

// The current state, without changing anything: whether this unsubscribe is already in effect
export async function isAlreadyUnsubscribed (user, { descriptor, groupId, frequency, slowedDaily }) {
  const [kind, key] = (descriptor || '').split(':')
  switch (kind) {
    case 'group_digest': {
      if (groupId) {
        const membership = await governingMembership(user.id, groupId)
        return !membership || membership.getSetting('digestFrequency') === 'never'
      }
      if (!frequency) return false
      const onFrequency = await bookshelf.knex('group_memberships')
        .where({ user_id: user.id, active: true })
        .whereIn(bookshelf.knex.raw('settings->>\'digestFrequency\''), unifiedFrequencies({ frequency, slowedDaily }))
        .count('id as count')
      return Number(onFrequency[0].count) === 0
    }
    case 'group_post_email': {
      const membership = groupId && await governingMembership(user.id, groupId)
      return !membership || membership.getSetting('sendEmail') === false
    }
    case 'membership_setting': {
      const membership = groupId && await governingMembership(user.id, groupId)
      return groupId ? (!membership || membership.getSetting(key) === false) : false
    }
    case 'comment_email':
      return !EMAIL_OFF[user.getSetting('comment_notifications') || 'both']
    case 'dm_email':
      return !EMAIL_OFF[user.getSetting('dm_notifications') || 'both']
    default:
      return false
  }
}

export default async function applyUnsubscribe (user, { descriptor, groupId, frequency, slowedDaily }) {
  const [kind, key] = (descriptor || '').split(':')
  switch (kind) {
    case 'group_digest':
      if (groupId) return setMembershipSetting(user.id, groupId, 'digestFrequency', 'never')
      if (frequency) {
        return setEveryMembership(user.id, 'digestFrequency', 'never',
          { key: 'digestFrequency', values: unifiedFrequencies({ frequency, slowedDaily }) })
      }
      return { applied: false, changed: false }
    case 'group_post_email':
      return groupId
        ? setMembershipSetting(user.id, groupId, 'sendEmail', false)
        : { applied: false, changed: false }
    case 'membership_setting':
      if (!key) return { applied: false, changed: false }
      return groupId
        ? setMembershipSetting(user.id, groupId, key, false)
        : setEveryMembership(user.id, key, false)
    case 'comment_email':
      return turnOffUserEmailSetting(user, 'comment_notifications')
    case 'dm_email':
      return turnOffUserEmailSetting(user, 'dm_notifications')
    default:
      return { applied: false, changed: false }
  }
}
