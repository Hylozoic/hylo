/*
  One reminder email to someone who started signing up and stopped: they gave
  their email address (so an account was made for it) but never finished
  creating the account. It goes out once, 48 hours after they started, and is
  marked on the user (settings.stalled_signup_reminder_sent_at) before it is
  sent, so nobody gets it twice. When a pending invitation to their address
  exists, the email names the group and who invited them and links to the
  invitation; otherwise it links to the signup page. Nothing about signing up or
  verifying an email address changes.

  Nothing is sent until STALLED_SIGNUP_REMINDER_TEMPLATE_ID names the email
  template.
*/
import { normalizeLocaleToFull } from '../../../lib/localeHelpers'

export const REMIND_AFTER_HOURS = 48
// People who started longer ago than this are left alone, so the first run doesn't email old signups
export const LOOK_BACK_DAYS = 7
const SENT_SETTING = 'stalled_signup_reminder_sent_at'

/** Who started signing up in the window and has not finished or been reminded. */
function stalledSignups (now) {
  const hour = 60 * 60 * 1000
  return bookshelf.knex('users')
    .where('users.active', false)
    .whereNull('users.name')
    .whereNotNull('users.email')
    .where('users.created_at', '<=', new Date(now.getTime() - REMIND_AFTER_HOURS * hour))
    .where('users.created_at', '>', new Date(now.getTime() - LOOK_BACK_DAYS * 24 * hour))
    .whereRaw("coalesce((users.settings->>'signup_in_progress')::boolean, false) = true")
    .whereRaw('users.settings->>? IS NULL', [SENT_SETTING])
    .whereNotExists(function () {
      this.select(bookshelf.knex.raw(1)).from('invitation_opt_outs')
        .whereRaw('invitation_opt_outs.email = lower(users.email)')
    })
    .select('users.id', 'users.email', bookshelf.knex.raw("users.settings->>'locale' as locale"))
    .orderBy('users.id')
}

/** Mark the reminder on the user, only if nobody marked it first. Returns whether this call did. */
async function markSent (userId, now) {
  const updated = await bookshelf.knex('users')
    .where('id', userId)
    .whereRaw('settings->>? IS NULL', [SENT_SETTING])
    .update({
      settings: bookshelf.knex.raw("coalesce(settings, '{}'::jsonb) || jsonb_build_object(?::text, ?::text)", [SENT_SETTING, now.toISOString()])
    })
  return updated > 0
}

/** The most recent pending invitation to this address, with its group and sender, or null. */
function pendingInvitation (email) {
  return Invitation.query(q => {
    q.whereRaw('lower(email) = lower(?)', [email])
    q.whereNull('used_by_id')
    q.whereNull('expired_by_id')
    q.orderBy('created_at', 'desc')
  }).fetch({ withRelated: ['creator', 'group'] })
}

/** The template data: where to continue, and the invitation when there is one. */
export async function reminderData (email) {
  const invitation = await pendingInvitation(email)
  const group = invitation?.relations.group
  const creator = invitation?.relations.creator
  if (!invitation || !group || !group.get('active')) {
    return { has_invitation: false, continue_url: `${Frontend.Route.prefix}/signup` }
  }
  return {
    has_invitation: true,
    continue_url: invitation.isLimited()
      ? Frontend.Route.invitation(invitation.get('token'))
      : Frontend.Route.useInvitation(invitation.get('token'), invitation.get('email')),
    group_name: group.get('name'),
    group_avatar_url: group.get('avatar_url'),
    inviter_name: creator ? creator.get('name') : null
  }
}

/**
 * Send the stalled-signup reminders that are due.
 * @returns {Promise<number>} how many were sent
 */
export async function sendStalledSignupReminders ({ now = new Date() } = {}) {
  if (!process.env.STALLED_SIGNUP_REMINDER_TEMPLATE_ID) return 0
  let count = 0
  for (const user of await stalledSignups(now)) {
    if (!await markSent(user.id, now)) continue
    try {
      const data = await reminderData(user.email)
      await Email.sendStalledSignupReminder({ email: user.email, data, locale: normalizeLocaleToFull(user.locale) })
      count++
    } catch (err) {
      sails.log.error('Stalled signup reminder failed', err)
    }
  }
  return count
}
