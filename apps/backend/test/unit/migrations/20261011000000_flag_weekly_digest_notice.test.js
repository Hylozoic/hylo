/* eslint-disable no-unused-expressions */
import setup from '../../setup'
import factories from '../../setup/factories'

const migration = require('../../../migrations/20261011000000_flag_weekly_digest_notice')

const KEY = 'weekly_digest_notice_pending'

describe('migration 20261011000000_flag_weekly_digest_notice', () => {
  let group, space, closedGroup
  const users = {}

  const settingsOf = async user => (await bookshelf.knex('users').where('id', user.id).first('settings')).settings || {}

  before(async () => {
    await setup.clearDb()
    group = await factories.group().save()
    closedGroup = await factories.group({ active: false }).save()
    space = await factories.group({ type: 'space', parent_id: group.id }).save()

    const member = async (name, target, settings, userAttrs = {}) => {
      users[name] = await factories.user(userAttrs).save()
      await target.addMembers([users[name].id], { settings })
    }
    await member('weekly', group, { digestFrequency: 'weekly', sendEmail: true })
    await member('daily', group, { digestFrequency: 'daily', sendEmail: true })
    await member('weeklyEmailOff', group, { digestFrequency: 'weekly', sendEmail: false })
    await member('weeklySpaceOnly', space, { digestFrequency: 'weekly', sendEmail: true })
    await member('weeklyInactiveGroup', closedGroup, { digestFrequency: 'weekly', sendEmail: true })
    await member('alreadyNotified', group, { digestFrequency: 'weekly', sendEmail: true }, { settings: { locale: 'en-US', [KEY]: false } })
    await member('deactivated', group, { digestFrequency: 'weekly', sendEmail: true }, { active: false })
  })

  after(() => setup.clearDb())

  it('flags only active members who get a weekly digest, and runs again without changes', async () => {
    await migration.up(bookshelf.knex)
    const flagged = async () => {
      const result = {}
      for (const [name, user] of Object.entries(users)) result[name] = (await settingsOf(user))[KEY]
      return result
    }
    const expected = {
      weekly: true,
      daily: undefined,
      weeklyEmailOff: undefined,
      weeklySpaceOnly: undefined,
      weeklyInactiveGroup: undefined,
      alreadyNotified: false,
      deactivated: undefined
    }
    expect(await flagged()).to.deep.equal(expected)
    expect((await settingsOf(users.weekly)).locale).to.equal('en-US')

    await migration.up(bookshelf.knex)
    expect(await flagged()).to.deep.equal(expected)

    await migration.down(bookshelf.knex)
    for (const user of Object.values(users)) {
      expect(await settingsOf(user)).not.to.have.property(KEY)
    }
    expect((await settingsOf(users.weekly)).locale).to.equal('en-US')
  })
})
