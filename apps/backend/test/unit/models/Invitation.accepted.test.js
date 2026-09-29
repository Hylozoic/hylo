/* eslint-disable no-unused-expressions */
const root = require('root-path')
const setup = require(root('test/setup'))
const factories = require(root('test/setup/factories'))
const { mockify, unspyify, withFeatureFlag } = require(root('test/setup/helpers'))
const InvitationService = require(root('api/services/InvitationService'))
const { createJoinRequest } = require(root('api/graphql/mutations/join_request'))

// D47: the person whose invitation is accepted hears that the invitee joined
describe('telling the inviter their invitation was accepted', () => {
  let steward, member, open, restricted, jobs

  // Runs the background work queued by the joins so far, as the worker would
  const runQueuedJoins = async () => {
    const queued = jobs.filter(job => job.className === 'Group' && job.methodName === 'afterAddMembers')
    jobs = []
    for (const job of queued) await Group.afterAddMembers(job.data)
  }

  const noticesTo = async (reader, { actor, group } = {}) => {
    const rows = await Activity.query(q => {
      q.where('reader_id', reader.id)
      q.whereRaw("meta->'reasons' \\? 'invitationAccepted'")
      if (actor) q.where('actor_id', actor.id)
      if (group) q.where('group_id', group.id)
    }).fetchAll()
    return rows.models
  }

  before(async () => {
    steward = await factories.user({ name: 'Inviting Steward' }).save()
    member = await factories.user({ name: 'Inviting Member' }).save()
    open = await factories.group({ accessibility: Group.Accessibility.OPEN }).save()
    restricted = await factories.group({ accessibility: Group.Accessibility.RESTRICTED }).save()
    await steward.joinGroup(open, { assignAdministrator: true })
    await steward.joinGroup(restricted, { assignAdministrator: true })
    await member.joinGroup(open)
    await member.joinGroup(restricted)
  })

  beforeEach(() => {
    jobs = []
    mockify(Queue, 'classMethod', (className, methodName, data) => {
      jobs.push({ className, methodName, data })
      return Promise.resolve()
    })
  })

  afterEach(() => unspyify(Queue, 'classMethod'))

  after(async function () {
    this.timeout(10000)
    await setup.clearDb()
  })

  it('tells the steward once, in the app and by push, when their email invitation is accepted', async () => {
    const invitee = await factories.user({ name: 'New Person' }).save()
    const invitation = await Invitation.create({ userId: steward.id, groupId: open.id, email: invitee.get('email') })

    await invitation.use(invitee.id)
    await runQueuedJoins()
    await (await Invitation.find(invitation.id)).use(invitee.id)
    await runQueuedJoins()

    const notices = await noticesTo(steward, { actor: invitee, group: open })
    expect(notices).to.have.length(1)
    const media = (await Notification.where({ activity_id: notices[0].id }).fetchAll()).map(n => n.get('medium'))
    expect(media.sort()).to.deep.equal([Notification.MEDIUM.InApp, Notification.MEDIUM.Push].sort())
  })

  it('writes the push as "<Name> joined <group>, say hi", opening the new member\'s profile', async () => {
    const invitee = await factories.user({ name: 'Pushed Person' }).save()
    const invitation = await Invitation.create({ userId: steward.id, groupId: open.id, email: invitee.get('email') })
    await invitation.use(invitee.id)
    await runQueuedJoins()

    const [activity] = await noticesTo(steward, { actor: invitee })
    const notification = await Notification.where({ activity_id: activity.id, medium: Notification.MEDIUM.Push })
      .fetch({ withRelated: ['activity', 'activity.actor', 'activity.reader', 'activity.group'] })
    const pushes = []
    mockify(User.prototype, 'sendPushNotification', function (alertText, path) {
      pushes.push({ alertText, path })
      return Promise.resolve()
    })
    try {
      await notification.sendPush()
    } finally {
      unspyify(User.prototype, 'sendPushNotification')
    }
    expect(pushes).to.have.length(1)
    expect(pushes[0].alertText).to.equal(`Pushed Person joined ${open.get('name')}, say hi`)
    expect(pushes[0].path).to.include(`/members/${invitee.id}`)
  })

  it('tells the member who sponsored a request once a steward accepts it', async () => {
    await withFeatureFlag('MEMBER_INVITES', 'on', async () => {
      await GroupRole.setInvitePolicy(restricted.id, { mode: 'everyone' })
      const invitee = await factories.user().save()
      const invitation = await Invitation.create({
        userId: member.id, groupId: restricted.id, email: invitee.get('email'), inviterAccess: Invitation.InviterAccess.LIMITED
      })
      const { request } = await createJoinRequest(invitee.id, restricted.id, [], invitation.get('token'))
      await request.accept(steward.id)
      await runQueuedJoins()

      expect(await noticesTo(member, { actor: invitee, group: restricted })).to.have.length(1)
      expect(await noticesTo(steward, { actor: invitee })).to.have.length(0)
    })
  })

  it('tells the member whose invite link led to a request once a steward accepts it', async () => {
    await withFeatureFlag('MEMBER_INVITES', 'on', async () => {
      await GroupRole.setInvitePolicy(restricted.id, { mode: 'everyone' })
      const link = await MemberInviteLink.findOrCreate({ groupId: restricted.id, userId: member.id })
      const invitee = await factories.user().save()
      const { request } = await createJoinRequest(invitee.id, restricted.id, [], null, link.get('code'))
      await request.accept(steward.id)
      await runQueuedJoins()

      expect(await noticesTo(member, { actor: invitee, group: restricted })).to.have.length(1)
    })
  })

  it('tells the member whose personal invite link someone joined through, while member invitations are on', async () => {
    await withFeatureFlag('MEMBER_INVITES', 'on', async () => {
      await GroupRole.setInvitePolicy(open.id, { mode: 'everyone' })
      const link = await MemberInviteLink.findOrCreate({ groupId: open.id, userId: member.id })
      const invitee = await factories.user().save()
      await InvitationService.use(invitee.id, null, link.get('code'))
      await runQueuedJoins()
      expect(await noticesTo(member, { actor: invitee, group: open })).to.have.length(1)
    })
  })

  it("tells nobody about a member's invitation while member invitations are off", async () => {
    const invitee = await factories.user().save()
    const invitation = await Invitation.create({
      userId: member.id, groupId: open.id, email: invitee.get('email'), inviterAccess: Invitation.InviterAccess.LIMITED
    })
    await withFeatureFlag('MEMBER_INVITES', 'off', async () => {
      await InvitationService.use(invitee.id, invitation.get('token'))
      await runQueuedJoins()
    })
    expect(await GroupMembership.forPair(invitee.id, open.id).fetch()).to.exist
    expect(await noticesTo(member, { actor: invitee })).to.have.length(0)
  })

  it("tells nobody about joining through the group's own join link", async () => {
    const invitee = await factories.user().save()
    await InvitationService.use(invitee.id, null, open.get('access_code'))
    await runQueuedJoins()
    expect(await GroupMembership.forPair(invitee.id, open.id).fetch()).to.exist
    const all = await Activity.query(q => {
      q.where('actor_id', invitee.id)
      q.whereRaw("meta->'reasons' \\? 'invitationAccepted'")
    }).fetchAll()
    expect(all.length).to.equal(0)
  })

  it('tells nobody about a join with no inviter recorded, or an invitation people sent themselves', async () => {
    const invitee = await factories.user().save()
    await open.addMembers([invitee.id], { joinSource: GroupMembership.JoinSource.EMAIL_INVITE })
    const requester = await factories.user().save()
    const { request } = await createJoinRequest(requester.id, restricted.id, [])
    await request.accept(steward.id)
    await runQueuedJoins()
    expect(await GroupMembership.forPair(invitee.id, open.id).fetch()).to.exist
    expect(await GroupMembership.forPair(requester.id, restricted.id).fetch()).to.exist
    expect(await noticesTo(steward, { actor: requester })).to.have.length(0)

    const selfInviter = await factories.user().save()
    await open.addMembers([selfInviter.id], { joinSource: GroupMembership.JoinSource.EMAIL_INVITE, invitedById: selfInviter.id })
    await runQueuedJoins()

    expect(await noticesTo(selfInviter)).to.have.length(0)
    const aboutInvitee = await Activity.query(q => {
      q.where('actor_id', invitee.id)
      q.whereRaw("meta->'reasons' \\? 'invitationAccepted'")
    }).fetchAll()
    expect(aboutInvitee.length).to.equal(0)
  })

  it('tells nobody when the inviter has left the group since', async () => {
    const leaver = await factories.user().save()
    await leaver.joinGroup(open, { assignAdministrator: true })
    const invitee = await factories.user().save()
    const invitation = await Invitation.create({ userId: leaver.id, groupId: open.id, email: invitee.get('email') })
    await open.removeMembers([leaver.id])
    await invitation.use(invitee.id)
    await runQueuedJoins()
    expect(await GroupMembership.forPair(invitee.id, open.id).fetch()).to.exist
    expect(await noticesTo(leaver)).to.have.length(0)
  })
})
