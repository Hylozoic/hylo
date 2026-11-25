/* global bookshelf */
import { GROUP_ASSISTANT_AGREEMENT } from '@hylo/shared'

/**
 * Members' consent to the Group Assistant (#1780, decisions Q-29 and Q-31).
 *
 * While a group's assistant is on, its agreements include GROUP_ASSISTANT_AGREEMENT: an ordinary
 * agreement row, so it shows wherever the group's agreements do and goes through the regular
 * "agreements have changed" prompt. A member's answer is kept where every agreement's is, in
 * users_groups_agreements: accepted = true is consent, accepted = false is a "no", and no row
 * means they have not answered yet. Only members with accepted = true have anything of theirs
 * sent to the AI provider (see groupAssistantContent.js); "no" and "not answered" are treated
 * the same, so nothing is sent before a member agrees.
 *
 * Accepting a group's agreements in general (GroupMembership#acceptAgreements, used by every
 * join flow) never accepts this one: it is only ever recorded by setAssistantConsent, from the
 * member's own choice.
 */

const knex = () => bookshelf.knex

const run = (query, transacting) => transacting ? query.transacting(transacting) : query

/** The agreement row for GROUP_ASSISTANT_AGREEMENT, created the first time it is needed. Returns its id. */
export async function assistantAgreementRowId ({ transacting, create = true } = {}) {
  const { title, description } = GROUP_ASSISTANT_AGREEMENT
  const existing = await run(knex()('agreements').where({ title, description }).orderBy('id', 'asc').first('id'), transacting)
  if (existing) return String(existing.id)
  if (!create) return null
  const [row] = await run(knex()('agreements').insert({ title, description, created_at: new Date(), updated_at: new Date() }).returning('id'), transacting)
  return String(row.id || row)
}

/** The id of the assistant's agreement if it is one of this group's agreements now, otherwise null. */
export async function groupAssistantAgreementId (groupId, { transacting } = {}) {
  const agreementId = await assistantAgreementRowId({ transacting, create: false })
  if (!agreementId) return null
  const linked = await run(knex()('groups_agreements').where({ group_id: groupId, agreement_id: agreementId, active: true }).first('id'), transacting)
  return linked ? agreementId : null
}

/**
 * Adds the assistant's agreement to the end of a group's agreements, and marks the agreements as
 * changed so every member gets the regular "agreements have changed" prompt. The steward making
 * the change is not asked to re-accept the other agreements (as when a steward edits them), but
 * is asked about this one like everyone else. Returns true if it was added, false if it was there.
 */
export async function addAssistantAgreement (group, stewardId) {
  return bookshelf.transaction(async transacting => {
    const agreementId = await assistantAgreementRowId({ transacting })
    const linked = await knex()('groups_agreements').transacting(transacting).where({ group_id: group.id, agreement_id: agreementId }).first('id', 'active')
    if (linked?.active) return false
    const last = await knex()('groups_agreements').transacting(transacting).where({ group_id: group.id }).max('order as order').first()
    if (linked) {
      await knex()('groups_agreements').transacting(transacting).where('id', linked.id).update({ active: true, order: (last?.order || 0) + 1, updated_at: new Date() })
    } else {
      await knex()('groups_agreements').transacting(transacting).insert({ group_id: group.id, agreement_id: agreementId, order: (last?.order || 0) + 1, active: true, created_at: new Date(), updated_at: new Date() })
    }
    const now = new Date().toISOString()
    await knex()('groups').transacting(transacting).where('id', group.id).update({
      settings: knex().raw("jsonb_set(COALESCE(settings, '{}'::jsonb), '{agreements_last_updated_at}', ?::jsonb)", [JSON.stringify(now)])
    })
    if (stewardId) {
      await knex()('group_memberships').transacting(transacting).where({ user_id: stewardId, group_id: group.id }).update({
        settings: knex().raw("jsonb_set(COALESCE(settings, '{}'::jsonb), '{agreementsAcceptedAt}', ?::jsonb)", [JSON.stringify(now)])
      })
    }
    return true
  })
}

/**
 * Takes the assistant's agreement out of a group's agreements (the assistant was turned off).
 * Members' answers are kept, so turning it back on asks again with their last answer filled in.
 * Not an agreements change for members: nothing new is asked of them.
 */
export async function removeAssistantAgreement (group) {
  const agreementId = await assistantAgreementRowId({ create: false })
  if (!agreementId) return
  await knex()('groups_agreements').where({ group_id: group.id, agreement_id: agreementId }).del()
}

/**
 * The ids (strings) of the active members of a group who have accepted the assistant's agreement.
 * Empty when the group does not have the agreement, so nothing is sent then.
 */
export async function consentingMemberIds (groupId) {
  const agreementId = await groupAssistantAgreementId(groupId)
  if (!agreementId) return new Set()
  const ids = await knex()('users_groups_agreements')
    .join('group_memberships', function () {
      this.on('group_memberships.user_id', '=', 'users_groups_agreements.user_id')
        .andOn('group_memberships.group_id', '=', 'users_groups_agreements.group_id')
    })
    .where({ 'users_groups_agreements.group_id': groupId, 'users_groups_agreements.agreement_id': agreementId, 'users_groups_agreements.accepted': true })
    .where('group_memberships.active', true)
    .distinct('users_groups_agreements.user_id')
    .pluck('users_groups_agreements.user_id')
  return new Set(ids.map(String))
}

/**
 * One member's answer: 'accepted', 'declined' or 'pending' (not answered yet), or null when the
 * group does not have the assistant's agreement (nothing to answer).
 */
export async function assistantConsentFor (userId, groupId) {
  if (!userId) return null
  const agreementId = await groupAssistantAgreementId(groupId)
  if (!agreementId) return null
  const row = await knex()('users_groups_agreements')
    .where({ user_id: userId, group_id: groupId, agreement_id: agreementId })
    .orderBy('id', 'desc')
    .first('accepted')
  if (!row) return 'pending'
  return row.accepted ? 'accepted' : 'declined'
}

/** Records a member's own answer to the assistant's agreement. Returns the new answer. */
export async function setAssistantConsent (userId, groupId, accepted) {
  const agreementId = await groupAssistantAgreementId(groupId)
  if (!agreementId) throw new Error('This group is not sharing anything with an AI assistant')
  const where = { user_id: userId, group_id: groupId, agreement_id: agreementId }
  const updated = await knex()('users_groups_agreements').where(where).update({ accepted: !!accepted, updated_at: new Date() })
  if (!updated) await knex()('users_groups_agreements').insert({ ...where, accepted: !!accepted, created_at: new Date(), updated_at: new Date() })
  return accepted ? 'accepted' : 'declined'
}

/**
 * Forgets members' answers to the assistant's agreement (they left the group), so someone who
 * comes back is asked again instead of being treated as having said no.
 */
export async function forgetAssistantConsent (userIds, groupId, { transacting } = {}) {
  const agreementId = await assistantAgreementRowId({ transacting, create: false })
  if (!agreementId || !userIds?.length) return
  await run(knex()('users_groups_agreements').whereIn('user_id', userIds).where({ group_id: groupId, agreement_id: agreementId }).del(), transacting)
}
