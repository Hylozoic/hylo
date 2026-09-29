/* eslint-disable no-unused-expressions, camelcase */
import { mockify, spyify, unspyify } from '../../setup/helpers'
import { sortBy } from 'lodash/fp'
const root = require('root-path')
const setup = require(root('test/setup'))
const factories = require(root('test/setup/factories'))

describe('Invitation', function () {
  before(() => setup.clearDb())

  describe('.find', () => {
    it('ignores a blank id', () => {
      return Invitation.find(null).then(i => expect(i).to.be.null)
    })
  })

  describe('#use', function () {
    let user, group, tag, invitation1, invitation2, inviter

    before(async () => {
      inviter = await factories.user().save()
      user = await factories.user().save()
      group = await factories.group().save()
      tag = await new Tag({ name: 'taginvitationtest' }).save()
      invitation1 = await Invitation.create({
        userId: inviter.id,
        groupId: group.id,
        email: 'foo@comcom.com',
        assignAdministrator: true
      })
      invitation2 = await Invitation.create({
        userId: inviter.id,
        groupId: group.id,
        email: 'foo@comcom.com',
        assignAdministrator: true,
        tag_id: tag.id
      })
    })

    it('creates a membership and marks itself used', async () => {
      await bookshelf.transaction(trx => invitation1.use(user.id, { transacting: trx }))
      expect(invitation1.get('used_by_id')).to.equal(user.id)
      expect(invitation1.get('used_at').getTime()).to.be.closeTo(new Date().getTime(), 2000)
      const hasAdministration = await GroupMembership.hasResponsibility(user, group, Responsibility.constants.RESP_ADMINISTRATION)
      expect(hasAdministration).to.be.true
    })

    it('records the invitation and inviter as the source of the membership', async () => {
      const invitee = await factories.user().save()
      const invitation = await Invitation.create({ userId: inviter.id, groupId: group.id, email: invitee.get('email') })
      await invitation.use(invitee.id)
      const membership = await GroupMembership.forPair(invitee, group).fetch()
      expect(membership.getSetting('joinSource')).to.equal('email_invite')
      expect(membership.getSetting('invitationId')).to.equal(invitation.id)
      expect(membership.getSetting('invitedById')).to.equal(inviter.id)
    })

    it('creates a tag_follow when it has a tag_id', function () {
      return bookshelf.transaction(trx => invitation2.use(user.id, { transacting: trx }))
        .then(TagFollow.where({
          user_id: user.id,
          group_id: group.id,
          tag_id: tag.id
        }).fetch())
        .then(tagFollow => expect(tagFollow).to.exist)
    })
  })

  describe('.reinviteAll', () => {
    let group, c2, user, inviter
    before(() => {
      group = factories.group()
      c2 = factories.group()
      user = factories.user()
      inviter = factories.user()
      spyify(Email, 'sendInvitation', () => Promise.resolve({}))
      return Promise.join(inviter.save(), user.save(), group.save(), c2.save())
        .then(() => {
          return Promise.join(
            Invitation.create({
              groupId: group.id,
              userId: inviter.id,
              email: 'foo@bar.com'
            }),
            Invitation.create({
              groupId: group.id,
              userId: inviter.id,
              email: 'bar@baz.com'
            }),
            Invitation.create({
              groupId: c2.id,
              userId: inviter.id,
              email: 'baz@foo.com'
            })
          )
        })
    })

    after(() => unspyify(Email, 'sendInvitation'))

    it('calls Email.sendInvitation twice', () => {
      return Invitation.reinviteAll({
        userId: inviter.id,
        groupId: group.id
      })
        .then(() => {
          expect(Email.sendInvitation).to.have.been.called.exactly(2)
        })
    })

    it('leaves invitations sent by members to the automatic reminders', async () => {
      const memberInvitation = await Invitation.create({
        groupId: c2.id,
        userId: user.id,
        email: 'member-sent@example.com',
        inviterAccess: Invitation.InviterAccess.LIMITED
      })
      await Invitation.reinviteAll({ userId: inviter.id, groupId: c2.id })
      expect((await Invitation.find(memberInvitation.id)).get('sent_count')).to.equal(0)
      const stewardInvitation = await Invitation.where({ group_id: c2.id, email: 'baz@foo.com' }).fetch()
      expect(stewardInvitation.get('sent_count')).to.equal(1)
    })
  })

  describe('createAndSend', () => {
    let group, user, inviter, invEmail, invData
    before(() => {
      group = factories.group()
      user = factories.user()
      inviter = factories.user()
      spyify(Email, 'sendInvitation', (email, data) => {
        invEmail = email
        invData = data
        return Promise.resolve({})
      })
      return Promise.join(inviter.save(), user.save(), group.save())
    })

    after(() => unspyify(Email, 'sendInvitation'))

    it('creates an invite and calls Email.sendInvitation', async () => {
      const subject = 'The invite subject'
      const message = 'The invite message'
      const email = 'foo@comcom.com'
      const invitation = await Invitation.create({
        userId: inviter.id,
        groupId: group.id,
        email,
        assignAdministrator: true,
        subject,
        message
      })
      // console.log('invitation in test', invitation)
      return Invitation.createAndSend({ invitation })
        .then(() => Invitation.where({ email, group_id: group.id }).fetch())
        .then(invitation => {
          expect(invitation).to.exist
          expect(invitation.get('subject')).to.equal(subject)
          expect(invitation.get('message')).to.equal(message)
        })
        .then(() => {
          expect(Email.sendInvitation).to.have.been.called.exactly(1)
          expect(invEmail).to.equal(email)
          expect(invData).to.contain({
            subject,
            message,
            inviter_name: inviter.get('name'),
            inviter_email: inviter.get('email'),
            group_name: group.get('name')
          })
          expect(invData.opt_out_url).to.match(new RegExp(`/noo/invitation/${invitation.get('token')}/opt-out\\?locale=en-US$`))
        })
    })
  })

  describe('addresses that asked for no more invitations', () => {
    let group, inviter, sent

    const invite = (email, attrs) => Invitation.create({ userId: inviter.id, groupId: group.id, email })
      .then(i => attrs ? i.save(attrs, { patch: true }) : i)

    before(async () => {
      group = await factories.group().save()
      inviter = await factories.user().save()
      sent = []
      mockify(Email, 'sendInvitation', email => {
        sent.push(email)
        return Promise.resolve({})
      })
      await InvitationOptOut.record({ email: 'Stop@OptedOut.com' })
    })

    after(() => unspyify(Email, 'sendInvitation'))

    beforeEach(() => { sent = [] })

    it('are never sent an invitation', async () => {
      const invitation = await invite('stop@optedout.com')
      expect(await invitation.send()).to.equal(false)
      await invitation.refresh()
      expect(invitation.get('sent_count')).to.equal(0)
      expect(sent).to.deep.equal([])
    })

    it('get no automatic reminders and are left out of Resend All', async () => {
      const day = 1000 * 60 * 60 * 24
      await invite('stop@optedout.com', { sent_count: 1, last_sent_at: new Date(Date.now() - 5 * day) })
      await invite('keep@optedout.com', { sent_count: 1, last_sent_at: new Date(Date.now() - 5 * day) })

      await Invitation.resendAllReady()
      expect(sent).to.include('keep@optedout.com')
      expect(sent).to.not.include('stop@optedout.com')

      sent = []
      await Invitation.reinviteAll({ groupId: group.id })
      expect(sent).to.include('keep@optedout.com')
      expect(sent).to.not.include('stop@optedout.com')
    })
  })

  describe('.resendAllReady', () => {
    let group, c2, inviter, user
    before(() => {
      group = factories.group()
      c2 = factories.group()
      inviter = factories.user()
      user = factories.user()
      const day = 1000 * 60 * 60 * 24
      const now = new Date()
      return Promise.join(inviter.save(), group.save(), c2.save(), user.save())
        .then(() => {
          const attributes = [
            {
              email: 'a@sendme.com',
              sent_count: 1,
              last_sent_at: new Date(now - 4.1 * day)
            },
            {
              email: 'b@sendme.com',
              sent_count: 2,
              last_sent_at: new Date(now - 9.1 * day)
            },
            {
              email: 'a@used.com',
              sent_count: 1,
              last_sent_at: new Date(now - 10 * day),
              used_by_id: user.id
            },
            {
              email: 'a@notyet.com',
              sent_count: 1,
              last_sent_at: new Date(now - 3 * day)
            },
            {
              email: 'b@notyet.com',
              sent_count: 2,
              last_sent_at: new Date(now - 8 * day)
            }
          ]

          const userId = inviter.id
          return Promise.map(attributes, ({ email, sent_count, last_sent_at, used_by_id }) =>
            Invitation.create({ groupId: group.id, userId, email })
              .then(i => i.save({ sent_count, last_sent_at, used_by_id }, { patch: true })))
        })
    })

    it('sends the invitations that are ready and unused', function () {
      this.timeout(10000)
      const now = new Date().getTime()

      return Invitation.resendAllReady()
        .then(() => Invitation.where({ group_id: group.id }).fetchAll())
        .then(invitations => {
          const expected = sortBy('email', [
            {
              email: 'a@sendme.com',
              sent_count: 2
            },
            {
              email: 'b@sendme.com',
              sent_count: 3
            },
            {
              email: 'a@used.com',
              sent_count: 1
            },
            {
              email: 'a@notyet.com',
              sent_count: 1
            },
            {
              email: 'b@notyet.com',
              sent_count: 2
            }
          ])

          expect(sortBy('email', invitations.map(i => ({
            email: i.get('email'),
            sent_count: i.get('sent_count')
          })))).to.deep.equal(expected)

          invitations.forEach(i => {
            const email = i.get('email')
            const lastSentAt = i.get('last_sent_at').getTime()
            if (email.match('@sendme.com')) {
              expect(lastSentAt).to.be.closeTo(now, 2000)
            } else {
              expect(lastSentAt).not.to.be.closeTo(now, 2000)
            }
          })
        })
    })
  })

  describe('.resendAllReady for invitations sent by members', () => {
    let admin, member, links, invitations

    const due = { sent_count: 1, last_sent_at: new Date(Date.now() - 4.1 * 24 * 60 * 60 * 1000) }

    const everyoneGroup = async () => {
      const group = await factories.group().save()
      await admin.joinGroup(group, { assignAdministrator: true })
      await GroupRole.setInvitePolicy(group.id, { mode: 'everyone' })
      return group
    }

    const invite = async (group, sender, email, inviterAccess = Invitation.InviterAccess.LIMITED) => {
      const invitation = await Invitation.create({ groupId: group.id, userId: sender.id, email, inviterAccess })
      await invitation.save(due, { patch: true })
      return invitation
    }

    before(async () => {
      links = {}
      mockify(Email, 'sendInvitation', (email, data) => {
        links[email] = data.invite_link
        return Promise.resolve({})
      })
      admin = await factories.user().save()
      member = await factories.user().save()

      const group = await everyoneGroup()
      await member.joinGroup(group)
      const leaver = await factories.user().save()
      await leaver.joinGroup(group)
      const deactivated = await factories.user().save()
      await deactivated.joinGroup(group)
      const requester = await factories.user().save()

      const stewardsGroup = await everyoneGroup()
      await member.joinGroup(stewardsGroup)

      const spaceGroup = await everyoneGroup()
      await member.joinGroup(spaceGroup)

      invitations = {
        ready: await invite(group, member, 'ready@member-sent.com'),
        leaver: await invite(group, leaver, 'leaver@member-sent.com'),
        deactivated: await invite(group, deactivated, 'deactivated@member-sent.com'),
        requested: await invite(group, member, 'requested@member-sent.com'),
        lostAccess: await invite(stewardsGroup, member, 'lost-access@member-sent.com'),
        steward: await invite(stewardsGroup, admin, 'steward@member-sent.com', Invitation.InviterAccess.FULL),
        space: await invite(spaceGroup, member, 'space@member-sent.com')
      }

      await GroupMembership.where({ user_id: leaver.id, group_id: group.id }).save({ active: false }, { patch: true })
      await bookshelf.knex('users').where({ id: deactivated.id }).update({ active: false })
      await new JoinRequest({
        group_id: group.id,
        user_id: requester.id,
        status: JoinRequest.STATUS.Pending,
        invitation_id: invitations.requested.id,
        created_at: new Date()
      }).save()
      await GroupRole.setInvitePolicy(stewardsGroup.id, { mode: 'stewards' })
      await bookshelf.knex('groups').where({ id: spaceGroup.id }).update({ type: 'space', parent_id: group.id })
    })

    after(() => unspyify(Email, 'sendInvitation'))

    it('reminds only while the sender can still invite and nobody has asked to join from it', async () => {
      const resentIds = await Invitation.resendAllReady()

      const sentCounts = {}
      for (const [name, invitation] of Object.entries(invitations)) {
        sentCounts[name] = (await Invitation.find(invitation.id)).get('sent_count')
      }
      expect(sentCounts).to.deep.equal({ ready: 2, leaver: 1, deactivated: 1, requested: 1, lostAccess: 1, steward: 2, space: 1 })
      const resent = resentIds.map(String)
      expect(resent).to.include.members([invitations.ready.id, invitations.steward.id].map(String))
      for (const name of ['leaver', 'deactivated', 'requested', 'lostAccess', 'space']) {
        expect(resent).to.not.include(String(invitations[name].id))
      }

      const token = invitations.ready.get('token')
      expect(links['ready@member-sent.com']).to.match(new RegExp(`/h/invitation\\?token=${token}$`))
      expect(links['steward@member-sent.com']).to.include('/h/use-invitation?token=')
    })
  })

  describe('the second automatic reminder', () => {
    let group, inviter, sentData

    before(async () => {
      group = await factories.group({ num_members: 12 }).save()
      inviter = await factories.user().save()
      const author = await factories.user().save()
      const recent = await factories.post({ user_id: author.id }).save()
      const old = await factories.post({ user_id: author.id }).save()
      await bookshelf.knex('posts').where('id', old.id).update({ created_at: new Date(Date.now() - 40 * 24 * 60 * 60 * 1000) })
      await bookshelf.knex('groups_posts').insert([{ post_id: recent.id, group_id: group.id }, { post_id: old.id, group_id: group.id }])
      sentData = {}
      mockify(Email, 'sendInvitation', (email, data) => {
        sentData[email] = data
        return Promise.resolve({})
      })
    })

    after(() => unspyify(Email, 'sendInvitation'))

    it('adds how many people are in the group and how active it has been, keeping the same schedule', async () => {
      const day = 24 * 60 * 60 * 1000
      const first = await Invitation.create({ userId: inviter.id, groupId: group.id, email: 'first-reminder@social-proof.com' })
      await first.save({ sent_count: 1, last_sent_at: new Date(Date.now() - 4.1 * day) }, { patch: true })
      const second = await Invitation.create({ userId: inviter.id, groupId: group.id, email: 'second-reminder@social-proof.com' })
      await second.save({ sent_count: 2, last_sent_at: new Date(Date.now() - 9.1 * day) }, { patch: true })
      const notYet = await Invitation.create({ userId: inviter.id, groupId: group.id, email: 'not-yet@social-proof.com' })
      await notYet.save({ sent_count: 2, last_sent_at: new Date(Date.now() - 8 * day) }, { patch: true })

      await Invitation.resendAllReady()

      expect(sentData['second-reminder@social-proof.com']).to.include({ social_proof: true, member_count: 12, recent_post_count: 1 })
      expect(sentData['first-reminder@social-proof.com']).to.exist
      expect(sentData['first-reminder@social-proof.com'].social_proof).to.be.undefined
      expect(sentData['not-yet@social-proof.com']).to.be.undefined
    })
  })

  describe('stalled signup reminder', () => {
    const { sendStalledSignupReminders, REMIND_AFTER_HOURS, LOOK_BACK_DAYS } = require(root('api/models/invitation/stalledSignupReminder'))
    const hoursAgo = hours => new Date(Date.now() - hours * 60 * 60 * 1000)
    let sent, previousTemplateId

    const signupStartedAt = (email, createdAt, settings = { signup_in_progress: true, locale: 'de' }) =>
      factories.user({ email, name: null, active: false, created_at: createdAt, settings }).save()

    before(async () => {
      previousTemplateId = process.env.STALLED_SIGNUP_REMINDER_TEMPLATE_ID
      process.env.STALLED_SIGNUP_REMINDER_TEMPLATE_ID = 'tem_test_stalled_signup'
      sent = []
      mockify(Email, 'sendStalledSignupReminder', opts => {
        sent.push(opts)
        return Promise.resolve({})
      })
      await signupStartedAt('stalled@stalled-signup.com', hoursAgo(REMIND_AFTER_HOURS + 1))
      await signupStartedAt('too-soon@stalled-signup.com', hoursAgo(REMIND_AFTER_HOURS - 1))
      await signupStartedAt('too-old@stalled-signup.com', hoursAgo(LOOK_BACK_DAYS * 24 + 1))
      await signupStartedAt('finished@stalled-signup.com', hoursAgo(REMIND_AFTER_HOURS + 1), { signup_in_progress: false })
      await signupStartedAt('opted-out@stalled-signup.com', hoursAgo(REMIND_AFTER_HOURS + 1))
      await InvitationOptOut.record({ email: 'opted-out@stalled-signup.com' })
      const invited = await signupStartedAt('invited@stalled-signup.com', hoursAgo(REMIND_AFTER_HOURS + 2))
      const group = await factories.group({ name: 'Stalled Signup Group' }).save()
      const inviter = await factories.user({ name: 'Stalled Signup Inviter' }).save()
      await Invitation.create({ userId: inviter.id, groupId: group.id, email: invited.get('email'), inviterAccess: Invitation.InviterAccess.LIMITED })
    })

    after(() => {
      unspyify(Email, 'sendStalledSignupReminder')
      if (previousTemplateId === undefined) delete process.env.STALLED_SIGNUP_REMINDER_TEMPLATE_ID
      else process.env.STALLED_SIGNUP_REMINDER_TEMPLATE_ID = previousTemplateId
    })

    it('reminds people who stopped signing up 48 hours ago, once, with their invitation when they have one', async () => {
      expect(await sendStalledSignupReminders()).to.equal(2)
      const byEmail = Object.fromEntries(sent.map(opts => [opts.email, opts]))
      expect(Object.keys(byEmail).sort()).to.deep.equal(['invited@stalled-signup.com', 'stalled@stalled-signup.com'])
      expect(byEmail['stalled@stalled-signup.com'].data).to.deep.equal({ has_invitation: false, continue_url: `${Frontend.Route.prefix}/signup` })
      expect(byEmail['stalled@stalled-signup.com'].locale).to.equal('de-DE')
      expect(byEmail['invited@stalled-signup.com'].data).to.include({
        has_invitation: true,
        group_name: 'Stalled Signup Group',
        inviter_name: 'Stalled Signup Inviter'
      })
      expect(byEmail['invited@stalled-signup.com'].data.continue_url).to.include('/h/invitation?token=')

      const marked = await User.query(q => q.whereRaw('lower(email) = ?', ['stalled@stalled-signup.com'])).fetch()
      expect(marked.get('settings').stalled_signup_reminder_sent_at).to.exist
      expect(marked.get('settings').signup_in_progress).to.equal(true)

      sent = []
      expect(await sendStalledSignupReminders()).to.equal(0)
      expect(sent).to.deep.equal([])
    })

    it('sends nothing until the email template is named', async () => {
      await signupStartedAt('no-template@stalled-signup.com', hoursAgo(REMIND_AFTER_HOURS + 1))
      delete process.env.STALLED_SIGNUP_REMINDER_TEMPLATE_ID
      sent = []
      expect(await sendStalledSignupReminders()).to.equal(0)
      process.env.STALLED_SIGNUP_REMINDER_TEMPLATE_ID = 'tem_test_stalled_signup'
      const waiting = await User.query(q => q.whereRaw('lower(email) = ?', ['no-template@stalled-signup.com'])).fetch()
      expect(waiting.get('settings').stalled_signup_reminder_sent_at).to.be.undefined
    })
  })

  describe('.expirePendingLimited', () => {
    let sender, other, groupA, groupB

    const create = (userId, groupId, inviterAccess = Invitation.InviterAccess.LIMITED) =>
      Invitation.create({ userId, groupId, email: `expire-${Date.now()}-${Math.random()}@example.com`, inviterAccess })
    const expiredBy = async invitation => (await Invitation.find(invitation.id)).get('expired_by_id')

    before(async () => {
      sender = await factories.user().save()
      other = await factories.user().save()
      groupA = await factories.group().save()
      groupB = await factories.group().save()
    })

    it('expires the pending member invitations a person sent in every group', async () => {
      const inA = await create(sender.id, groupA.id)
      const inB = await create(sender.id, groupB.id)
      const asSteward = await create(sender.id, groupA.id, Invitation.InviterAccess.FULL)
      const fromOther = await create(other.id, groupA.id)

      await Invitation.expirePendingLimited({ invitedByIds: [sender.id] })

      expect(await expiredBy(inA)).to.equal(sender.id)
      expect(await expiredBy(inB)).to.equal(sender.id)
      expect(await expiredBy(asSteward)).to.be.null
      expect(await expiredBy(fromOther)).to.be.null
    })

    it('needs a group or senders', async () => {
      await expect(Invitation.expirePendingLimited({})).to.be.rejectedWith('expirePendingLimited needs a groupId or invitedByIds')
    })
  })
})
