import { GraphQLError } from 'graphql'
import { isEmpty, mapKeys, pick, snakeCase } from 'lodash'

export async function updateMembership (userId, { groupId, data, data: { settings } }) {
  const whitelist = mapKeys(pick(data, [
    'newPostCount'
  ]), (v, k) => snakeCase(k))
  if (data.lastViewedAt) settings.lastReadAt = data.lastViewedAt // legacy
  if (data.lastReadAt) settings.lastReadAt = data.lastReadAt // XXX: this doesn't seem to be getting used either, remove?
  if (isEmpty(settings) && isEmpty(whitelist)) return Promise.resolve(null)

  return bookshelf.transaction(async transacting => {
    const membership = await GroupMembership.forIds(userId, groupId).fetch({ transacting })
    if (!membership) throw new GraphQLError(`Couldn't find membership for group with id ${groupId}`)
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
    if (membership.hasSetting('agreementsAcceptedAt') && settings.showJoinForm === false) {
      // Once agreements are accepted and join questtions are answered, we do some additional work/tasks
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
