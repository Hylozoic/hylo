/* eslint-disable no-unused-expressions */
import setup from '../../setup'
import factories from '../../setup/factories'

const migration = require('../../../migrations/20261015000000_backfill_notification_settings')

const JOIN_DEFAULTS = { postNotifications: 'all', digestFrequency: 'daily', sendEmail: true, sendPushNotifications: true }
const LEGACY_UNSUBSCRIBE_ALL = { digest_frequency: 'never', post_notifications: 'none', dm_notifications: 'none', comment_notifications: 'none' }

const membershipSettings = async id => (await bookshelf.knex('group_memberships').where('id', id).first('settings')).settings
const userSettings = async id => (await bookshelf.knex('users').where('id', id).first('settings')).settings

// Writes a membership row with exactly these settings, as older code left them
async function membership (user, group, settings, attrs = {}) {
  const [row] = await bookshelf.knex('group_memberships')
    .insert({ user_id: user.id, group_id: group.id, active: true, created_at: new Date(), settings: JSON.stringify(settings), ...attrs })
    .returning('id')
  return row.id || row
}

describe('migration 20261015000000_backfill_notification_settings', () => {
  describe('the patches', () => {
    it('fills only the keys an auto-added membership is missing, from the parent, else the defaults', () => {
      expect(migration.autoAddPatch({ showJoinForm: false }, { postNotifications: 'none', sendEmail: false }))
        .to.deep.equal({ postNotifications: 'none', digestFrequency: 'daily', sendEmail: false, sendPushNotifications: true })
      expect(migration.autoAddPatch({ postNotifications: 'all', sendEmail: null }, null))
        .to.deep.equal({ digestFrequency: 'daily', sendEmail: true, sendPushNotifications: true })
      expect(migration.autoAddPatch(JOIN_DEFAULTS, null)).to.deep.equal({})
    })

    it('reads less-email choices, leaving the old unsubscribe-all and scoped choices to their scope', () => {
      expect(migration.lessEmailChoices({ digest_frequency: 'weekly', post_notifications: 'all' })).to.deep.equal({ digestFrequency: 'weekly' })
      expect(migration.lessEmailChoices({ digest_frequency: 'daily', post_notifications: 'none' })).to.deep.equal({ postNotifications: 'none' })
      expect(migration.lessEmailChoices(LEGACY_UNSUBSCRIBE_ALL)).to.deep.equal({})
      expect(migration.lessEmailChoices({ digest_frequency: 'never', email_unsubscribe_scope: 'all_but_direct' })).to.deep.equal({})
    })

    it('only lowers a membership', () => {
      expect(migration.lessEmailPatch({ digestFrequency: 'weekly', postNotifications: 'all' }, { digestFrequency: 'weekly', postNotifications: 'important' }))
        .to.deep.equal({ postNotifications: 'important' })
    })
  })

  describe('on the database', () => {
    const ids = {}
    const users = {}
    let initial

    const snapshot = async () => {
      const result = {}
      for (const [name, id] of Object.entries(ids)) result[name] = await membershipSettings(id)
      for (const [name, user] of Object.entries(users)) result[`user:${name}`] = await userSettings(user.id)
      return result
    }

    before(async () => {
      await setup.clearDb()
      const parent = await factories.group().save()
      const weeklyGroup = await factories.group({ settings: { default_digest_frequency: 'weekly' } }).save()
      const autoAddSpace = await factories.group({ type: 'space', parent_id: parent.id, settings: { auto_add_members: true } }).save()
      const plainSpace = await factories.group({ type: 'space', parent_id: parent.id }).save()

      // (a) auto-added space members
      users.quietParent = await factories.user().save()
      await membership(users.quietParent, parent, { postNotifications: 'none', digestFrequency: 'weekly', sendEmail: false, sendPushNotifications: true })
      ids.autoAddedWithParent = await membership(users.quietParent, autoAddSpace, { joinSource: 'auto_add', showJoinForm: false })
      users.noParent = await factories.user().save()
      ids.autoAddedNoParent = await membership(users.noParent, autoAddSpace, { showJoinForm: false })
      ids.autoAddedPartly = await membership(users.noParent, plainSpace, { joinSource: 'auto_add', postNotifications: 'all', sendEmail: false })
      users.joinedSpaceThemselves = await factories.user().save()
      ids.ownSpaceMembership = await membership(users.joinedSpaceThemselves, plainSpace, { showJoinForm: false })

      // (b) saved less-email choices
      users.weekly = await factories.user({ settings: { locale: 'de', digest_frequency: 'weekly', post_notifications: 'none' } }).save()
      ids.weeklyAtDefaults = await membership(users.weekly, parent, JOIN_DEFAULTS)
      ids.weeklyChangedByThem = await membership(users.weekly, autoAddSpace, { ...JOIN_DEFAULTS, sendPushNotifications: false, joinSource: 'open' })
      ids.weeklyInWeeklyGroup = await membership(users.weekly, weeklyGroup, { ...JOIN_DEFAULTS, digestFrequency: 'weekly' })
      users.dailyAll = await factories.user({ settings: { digest_frequency: 'daily', post_notifications: 'all' } }).save()
      ids.defaultsKept = await membership(users.dailyAll, parent, JOIN_DEFAULTS)

      // (c) the old "Unsubscribe from all"
      users.unsubscribedAll = await factories.user({ settings: { ...LEGACY_UNSUBSCRIBE_ALL, locale: 'es' } }).save()
      ids.unsubscribedAllMembership = await membership(users.unsubscribedAll, parent, JOIN_DEFAULTS)
      users.everything = await factories.user({ settings: { ...LEGACY_UNSUBSCRIBE_ALL, email_unsubscribe_scope: 'everything' } }).save()

      initial = await snapshot()
    })

    // The table is part of the schema the other tests clear, so it is left in place
    after(async () => {
      if (!(await bookshelf.knex.schema.hasTable('notification_settings_backfill'))) await migration.up(bookshelf.knex)
      await setup.clearDb()
    })

    it('fills, copies and moves only what it should, and a second run changes nothing', async () => {
      await migration.up(bookshelf.knex)
      const after = await snapshot()

      // (a)
      expect(after.autoAddedWithParent).to.deep.equal({
        joinSource: 'auto_add', showJoinForm: false, postNotifications: 'none', digestFrequency: 'weekly', sendEmail: false, sendPushNotifications: true
      })
      expect(after.autoAddedNoParent).to.deep.equal({ showJoinForm: false, postNotifications: 'important', digestFrequency: 'daily', sendEmail: true, sendPushNotifications: true })
      expect(after.autoAddedPartly).to.deep.equal({ joinSource: 'auto_add', postNotifications: 'all', sendEmail: false, digestFrequency: 'daily', sendPushNotifications: true })
      expect(after.ownSpaceMembership).to.deep.equal(initial.ownSpaceMembership)

      // (b)
      expect(after.weeklyAtDefaults).to.deep.equal({ ...JOIN_DEFAULTS, digestFrequency: 'weekly', postNotifications: 'none' })
      expect(after.weeklyChangedByThem).to.deep.equal(initial.weeklyChangedByThem)
      expect(after.weeklyInWeeklyGroup).to.deep.equal({ ...JOIN_DEFAULTS, digestFrequency: 'weekly', postNotifications: 'none' })
      expect(after.defaultsKept).to.deep.equal(initial.defaultsKept)
      expect(after['user:weekly']).to.deep.equal(initial['user:weekly'])

      // (c)
      expect(after['user:unsubscribedAll']).to.deep.equal({
        ...LEGACY_UNSUBSCRIBE_ALL, locale: 'es', dm_notifications: 'both', comment_notifications: 'both', email_unsubscribe_scope: 'all_but_direct'
      })
      expect(after.unsubscribedAllMembership).to.deep.equal(JOIN_DEFAULTS)
      expect(after['user:everything']).to.deep.equal(initial['user:everything'])

      await migration.up(bookshelf.knex)
      expect(await snapshot()).to.deep.equal(after)
    })

    it('down() puts every value back, and up() after it does the same again', async () => {
      const afterUp = await snapshot()
      await migration.down(bookshelf.knex)
      expect(await snapshot()).to.deep.equal(initial)
      expect(await bookshelf.knex.schema.hasTable('notification_settings_backfill')).to.be.false

      await migration.up(bookshelf.knex)
      expect(await snapshot()).to.deep.equal(afterUp)
    })

    it('keeps a change made after the backfill to a key it did not touch', async () => {
      await bookshelf.knex.raw('UPDATE users SET settings = settings || \'{"locale": "fr"}\'::jsonb WHERE id = ?', [users.unsubscribedAll.id])
      await migration.down(bookshelf.knex)
      expect(await userSettings(users.unsubscribedAll.id)).to.deep.equal({ ...LEGACY_UNSUBSCRIBE_ALL, locale: 'fr' })
      await migration.up(bookshelf.knex)
    })
  })
})
