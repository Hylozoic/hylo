/* global GroupMembership, GroupJoinQuestionAnswer, Queue, bookshelf */
import { GraphQLError } from 'graphql'
import { isEmpty, mapKeys, pick, snakeCase } from 'lodash'

export async function updateMembership (userId, { groupId, data, data: { settings } }) {
  const whitelist = mapKeys(pick(data, [
    'newPostCount',
    'navOrder'
  ]), (v, k) => snakeCase(k))
  if (data.lastViewedAt) settings.lastReadAt = data.lastViewedAt // legacy
  if (data.lastReadAt) settings.lastReadAt = data.lastReadAt // XXX: this doesn't seem to be getting used either, remove?
  if (isEmpty(settings) && isEmpty(whitelist)) return Promise.resolve(null)

  return bookshelf.transaction(async transacting => {
    const membership = await GroupMembership.forIds(userId, groupId).fetch({ transacting })
    if (!membership) throw new GraphQLError(`Couldn't find membership for group with id ${groupId}`)
    const previouslyJoinedGroup = !membership.getSetting('showJoinForm')

    // Handle navOrder updates - need to update other pinned memberships
    if (data.navOrder !== undefined) {
      const newNavOrder = data.navOrder

      if (newNavOrder === null) {
        // Unpinning - no need to update other groups
      } else {
        // Check if this is a new pin (navOrder = 0) or a reorder
        const isNewPin = membership.get('nav_order') === null

        if (isNewPin) {
          // Pinning a new group to top (position 0) - increment all other pinned groups
          await bookshelf.knex('group_memberships')
            .where({ user_id: userId })
            .whereNotNull('nav_order')
            .where('group_id', '!=', groupId)
            .increment('nav_order', 1)
            .transacting(transacting)
        } else {
          // Reordering - handle moving up or down
          const currentNavOrder = membership.get('nav_order')

          if (newNavOrder > currentNavOrder) {
            // Moving down - decrement groups between current+1 and newNavOrder
            await bookshelf.knex('group_memberships')
              .where({ user_id: userId })
              .where('nav_order', '>', currentNavOrder)
              .where('nav_order', '<=', newNavOrder)
              .where('group_id', '!=', groupId)
              .decrement('nav_order', 1)
              .transacting(transacting)
          } else if (newNavOrder < currentNavOrder) {
            // Moving up - increment groups between newNavOrder and current-1
            await bookshelf.knex('group_memberships')
              .where({ user_id: userId })
              .where('nav_order', '>=', newNavOrder)
              .where('nav_order', '<', currentNavOrder)
              .where('group_id', '!=', groupId)
              .increment('nav_order', 1)
              .transacting(transacting)
          }
          // If newNavOrder === currentNavOrder, no changes needed
        }
      }
    }

    if (!isEmpty(settings)) membership.addSetting(settings)
    if (!isEmpty(whitelist)) membership.set(whitelist)
    if (data.acceptAgreements) {
      await membership.acceptAgreements(transacting)
    }
    if (data.questionAnswers) {
      for (const qa of data.questionAnswers) {
        await GroupJoinQuestionAnswer.forge({ group_id: groupId, question_id: qa.questionId, answer: qa.answer, user_id: userId }).save()
      }
    }
    if (!previouslyJoinedGroup && settings?.showJoinForm === false) {
      // First time a person finishes joining the group we do some additional stuff
      Queue.classMethod('Group', 'afterFinishedJoining', { userId, groupId })
    }
    if (membership.changed) await membership.save({}, { transacting })
    return membership
  })
}

export function updateAllMemberships (userId, { data: { settings } }) {
  const whitelist = pick(settings, ['postNotifications', 'digestFrequency'])
  if (isEmpty(whitelist)) return Promise.resolve(null)
  const whitelistString = Object.entries(whitelist).map(([key, value]) => `'${key}', '${value}'`).join(', ')
  return bookshelf.knex.raw('update group_memberships set settings = settings || jsonb_build_object(' + whitelistString + ') where user_id = ' + userId)
}
