/* eslint-disable no-unused-expressions */
import { pick } from 'lodash'
import setup from '../../setup'
import factories from '../../setup/factories'
import {
  applyCaps,
  groupNotificationDefaults,
  isLegacyUnsubscribeAll,
  lessEmailCaps,
  missingNotificationSettings,
  newMembershipNotificationSettings
} from '../../../api/models/group/membershipDefaults'
import { getRecipients } from '../../../lib/group/digest2/util'
import { createSpace, convertSpaceToChildGroup } from '../../../api/graphql/mutations/spaces'
import { assignAdministrator } from '../../setup/roleHelpers'

const KEYS = ['postNotifications', 'digestFrequency', 'sendEmail', 'sendPushNotifications']
const notificationSettings = membership => pick(membership.get('settings'), KEYS)
const membershipOf = (user, group) => GroupMembership.forPair(user, group, { includeInactive: true }).fetch()

const IMPORTANT_DAILY = { postNotifications: 'important', digestFrequency: 'daily', sendEmail: true, sendPushNotifications: true }
const LEGACY_UNSUBSCRIBE_ALL = { digest_frequency: 'never', post_notifications: 'none', dm_notifications: 'none', comment_notifications: 'none' }

describe('new membership notification settings (D1, D10, D11)', () => {
  before(() => setup.clearDb())
  after(() => setup.clearDb())

  describe('helpers', () => {
    it("reads the group's defaults, falling back to important and daily", () => {
      expect(groupNotificationDefaults({})).to.deep.equal(IMPORTANT_DAILY)
      expect(groupNotificationDefaults({ default_post_notifications: 'all', default_digest_frequency: 'weekly' }))
        .to.deep.equal({ ...IMPORTANT_DAILY, postNotifications: 'all', digestFrequency: 'weekly' })
      expect(groupNotificationDefaults({ default_post_notifications: 'none' }).postNotifications).to.equal('important')
    })

    it('turns saved less-email choices into caps', () => {
      expect(lessEmailCaps({})).to.deep.equal({})
      expect(lessEmailCaps({ email_unsubscribe_scope: 'digest_only' })).to.deep.equal({})
      expect(lessEmailCaps({ email_unsubscribe_scope: 'no_group_emails' })).to.deep.equal({ sendEmail: false })
      expect(lessEmailCaps({ email_unsubscribe_scope: 'all_but_direct' })).to.deep.equal({})
      expect(lessEmailCaps({ ...LEGACY_UNSUBSCRIBE_ALL, email_unsubscribe_scope: 'everything' }))
        .to.deep.equal({ sendEmail: false, sendPushNotifications: false })
      expect(lessEmailCaps({ digest_frequency: 'weekly', post_notifications: 'none' }))
        .to.deep.equal({ digestFrequency: 'weekly', postNotifications: 'none' })
      expect(lessEmailCaps({ digest_frequency: 'daily', post_notifications: 'all' })).to.deep.equal({})
      // The old "Unsubscribe from all" is covered by its scope, not by these four keys
      expect(isLegacyUnsubscribeAll(LEGACY_UNSUBSCRIBE_ALL)).to.be.true
      expect(lessEmailCaps(LEGACY_UNSUBSCRIBE_ALL)).to.deep.equal({})
    })

    it('only ever lowers a setting', () => {
      const caps = { digestFrequency: 'weekly', postNotifications: 'important' }
      expect(applyCaps({ digestFrequency: 'never', postNotifications: 'none' }, caps))
        .to.deep.equal({ digestFrequency: 'never', postNotifications: 'none' })
      expect(applyCaps({ digestFrequency: 'daily', postNotifications: 'all' }, caps))
        .to.deep.equal({ digestFrequency: 'weekly', postNotifications: 'important' })
    })

    it('lowers the defaults by the caps and merges caller settings over them', () => {
      const group = { default_post_notifications: 'all' }
      expect(newMembershipNotificationSettings(group, {}, { sendPushNotifications: false }))
        .to.deep.equal({ postNotifications: 'all', digestFrequency: 'daily', sendEmail: true, sendPushNotifications: false })
      expect(newMembershipNotificationSettings(group, { email_unsubscribe_scope: 'no_group_emails', digest_frequency: 'weekly' }, {}))
        .to.deep.equal({ postNotifications: 'all', digestFrequency: 'weekly', sendEmail: false, sendPushNotifications: true })
      // A caller's explicit value (an auto-added member's parent settings) wins
      expect(newMembershipNotificationSettings(group, { email_unsubscribe_scope: 'no_group_emails' }, { sendEmail: true }).sendEmail)
        .to.equal(true)
    })

    it('fills only the keys a returning membership is missing', () => {
      expect(missingNotificationSettings({ postNotifications: 'all', sendEmail: false }, {}, {}))
        .to.deep.equal({ digestFrequency: 'daily', sendPushNotifications: true })
      expect(missingNotificationSettings(IMPORTANT_DAILY, {}, {})).to.deep.equal({})
    })
  })

  describe('Group#addMembers', () => {
    it("starts a new member on 'important' and the group's default digest", async () => {
      const group = await factories.group().save()
      const user = await factories.user().save()
      await group.addMembers([user.id])
      expect(notificationSettings(await membershipOf(user, group))).to.deep.equal(IMPORTANT_DAILY)
    })

    it("uses the steward's default for the group", async () => {
      const group = await factories.group({ settings: { default_post_notifications: 'all', default_digest_frequency: 'weekly' } }).save()
      const user = await factories.user().save()
      await group.addMembers([user.id])
      expect(notificationSettings(await membershipOf(user, group)))
        .to.deep.equal({ ...IMPORTANT_DAILY, postNotifications: 'all', digestFrequency: 'weekly' })
    })

    it('leaves the notification settings of someone already in the group alone', async () => {
      const group = await factories.group({ settings: { default_post_notifications: 'all' } }).save()
      const user = await factories.user().save()
      await group.addMembers([user.id])
      const membership = await membershipOf(user, group)
      const own = { postNotifications: 'none', digestFrequency: 'never', sendEmail: false, sendPushNotifications: false }
      membership.addSetting(own)
      await membership.save()

      await group.addMembers([user.id])
      await user.joinGroup(group)
      expect(notificationSettings(await membershipOf(user, group))).to.deep.equal(own)
    })

    it('keeps the settings of a returning member and fills only missing keys', async () => {
      const group = await factories.group().save()
      const user = await factories.user().save()
      await group.addMembers([user.id])
      const membership = await membershipOf(user, group)
      membership.set('settings', { ...membership.get('settings'), postNotifications: 'all', sendEmail: false, digestFrequency: null })
      await membership.save()
      await group.removeMembers([user.id])

      await user.joinGroup(group)
      const rejoined = await membershipOf(user, group)
      expect(rejoined.get('active')).to.be.true
      expect(notificationSettings(rejoined)).to.deep.equal({ postNotifications: 'all', digestFrequency: 'daily', sendEmail: false, sendPushNotifications: true })
    })

    it('merges partial caller settings over the defaults instead of replacing them', async () => {
      const group = await factories.group().save()
      const user = await factories.user().save()
      await group.addMembers([user.id], { settings: { showJoinForm: false, sendPushNotifications: false } })
      const membership = await membershipOf(user, group)
      expect(membership.getSetting('showJoinForm')).to.equal(false)
      expect(notificationSettings(membership)).to.deep.equal({ ...IMPORTANT_DAILY, sendPushNotifications: false })
    })

    describe('saved less-email choices (D11)', () => {
      const joinWith = async userSettings => {
        const group = await factories.group().save()
        const user = await factories.user({ settings: userSettings }).save()
        await user.joinGroup(group)
        return { group, user, membership: await membershipOf(user, group) }
      }

      it("'No group emails' starts the membership with email off", async () => {
        const { membership } = await joinWith({ email_unsubscribe_scope: 'no_group_emails' })
        expect(notificationSettings(membership)).to.deep.equal({ ...IMPORTANT_DAILY, sendEmail: false })
      })

      it("'Everything' starts it with email and push off", async () => {
        const { membership } = await joinWith({ ...LEGACY_UNSUBSCRIBE_ALL, email_unsubscribe_scope: 'everything' })
        expect(notificationSettings(membership)).to.deep.equal({ ...IMPORTANT_DAILY, sendEmail: false, sendPushNotifications: false })
      })

      it('a saved weekly or never digest and no posts carry over', async () => {
        const { membership } = await joinWith({ digest_frequency: 'never', post_notifications: 'none' })
        expect(notificationSettings(membership)).to.deep.equal({ ...IMPORTANT_DAILY, digestFrequency: 'never', postNotifications: 'none' })
      })

      it("'Everything except direct' keeps group email and digests off while letting direct signals through", async () => {
        const previous = process.env.EMAIL_NOTIFICATIONS_ENABLED
        process.env.EMAIL_NOTIFICATIONS_ENABLED = 'true'
        try {
          const { group, user, membership } = await joinWith({ ...LEGACY_UNSUBSCRIBE_ALL, dm_notifications: 'both', comment_notifications: 'both', email_unsubscribe_scope: 'all_but_direct' })
          // Nothing is written to the membership: the saved scope keeps group email and
          // digests off, mentions still reach them by email (D7), and in-app notices stay
          expect(notificationSettings(membership)).to.deep.equal(IMPORTANT_DAILY)
          const recipients = await getRecipients(group.id, 'daily')
          expect(recipients.map(u => String(u.id))).to.not.include(String(user.id))
        } finally {
          process.env.EMAIL_NOTIFICATIONS_ENABLED = previous
        }
      })
    })
  })

  describe('auto-added space members (D10)', () => {
    it("gives 'important' to someone with no parent membership", async () => {
      const parent = await factories.group().save()
      const space = await factories.group({ type: 'space', parent_id: parent.id, settings: { auto_add_members: true } }).save()
      const user = await factories.user().save()
      await Group.addEligibleMembersToSpace({ spaceId: space.id, userIds: [user.id] })
      const membership = await membershipOf(user, space)
      expect(membership.getSetting('joinSource')).to.equal('auto_add')
      expect(notificationSettings(membership)).to.deep.equal(IMPORTANT_DAILY)
    })

    it('copies the parent membership, falling back to important for a missing key', async () => {
      const parent = await factories.group().save()
      const space = await factories.group({ type: 'space', parent_id: parent.id, settings: { auto_add_members: true } }).save()
      const user = await factories.user().save()
      await parent.addMembers([user.id])
      const parentMembership = await membershipOf(user, parent)
      parentMembership.set('settings', { ...parentMembership.get('settings'), postNotifications: null, digestFrequency: 'weekly' })
      await parentMembership.save()

      await Group.addEligibleMembersToSpace({ spaceId: space.id, userIds: [user.id] })
      expect(notificationSettings(await membershipOf(user, space)))
        .to.deep.equal({ ...IMPORTANT_DAILY, digestFrequency: 'weekly' })
    })

    it("applies a saved 'No group emails' to someone auto-added", async () => {
      const parent = await factories.group().save()
      const space = await factories.group({ type: 'space', parent_id: parent.id, settings: { auto_add_members: true } }).save()
      const user = await factories.user({ settings: { email_unsubscribe_scope: 'no_group_emails' } }).save()
      await Group.addEligibleMembersToSpace({ spaceId: space.id, userIds: [user.id] })
      expect((await membershipOf(user, space)).getSetting('sendEmail')).to.equal(false)
    })
  })

  describe('stewards copied into a converted space', () => {
    it('keep the notification keys alongside the skipped join form', async () => {
      const administrator = await factories.user().save()
      const moderator = await factories.user().save()
      const parent = await factories.group().save()
      await assignAdministrator(administrator, parent)
      await moderator.joinGroup(parent)
      await GroupRole.setupSystemRoles(parent.id)
      const moderatorRole = await GroupRole.findSystemRole(parent.id, 'Moderator')
      await MemberGroupRole.forge({ user_id: moderator.id, group_id: parent.id, group_role_id: moderatorRole.id, active: true }).save()

      const space = await createSpace(administrator.id, { parentGroupId: parent.id, name: `Defaults ${Date.now()}` }, {})
      const converted = await convertSpaceToChildGroup(administrator.id, space.id, {})
      const membership = await membershipOf(moderator, converted)
      expect(membership.getSetting('showJoinForm')).to.equal(false)
      expect(membership.getSetting('joinSource')).to.equal('space')
      expect(notificationSettings(membership)).to.deep.equal(IMPORTANT_DAILY)
    })
  })
})
