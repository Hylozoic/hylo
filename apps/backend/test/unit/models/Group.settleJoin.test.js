/* eslint-disable no-unused-expressions */
const root = require('root-path')
const setup = require(root('test/setup'))
const factories = require(root('test/setup/factories'))
const { mockify, unspyify } = require(root('test/setup/helpers'))
const { joinSpace } = require(root('api/graphql/mutations/spaces'))
const { grantCheckoutSessionAccess } = require(root('lib/grantCheckoutSessionAccess'))
/* global bookshelf, Group, GroupMembership, FundingRound, Track, StripeProduct, Queue */

describe('Group.settleJoin', () => {
  let steward, member, parent

  const reloadTrack = track => Track.where({ id: track.id }).fetch()
  const reloadRound = round => FundingRound.where({ id: round.id }).fetch()
  const membershipOf = (user, space) => GroupMembership.forPair(user.id, space.id).fetch()
  const enrollmentNotices = track => bookshelf.knex('activities').where({ track_id: track.id })

  const makeSpace = attrs => factories.group({
    type: 'space',
    parent_id: parent.id,
    accessibility: Group.Accessibility.OPEN,
    visibility: Group.Visibility.PROTECTED,
    slug: `settle-join-${Date.now()}-${Math.round(Math.random() * 100000)}`,
    ...attrs
  }).save()

  beforeEach(async () => {
    await setup.clearDb()
    mockify(Queue, 'classMethod', () => Promise.resolve())
    steward = await factories.user().save()
    member = await factories.user().save()
    parent = await factories.group().save()
    await parent.addMembers([steward.id], { assignAdministrator: true })
    await parent.addMembers([member.id])
  })

  afterEach(() => unspyify(Queue, 'classMethod'))

  describe('in a track space', () => {
    let space, track

    beforeEach(async () => {
      space = await makeSpace({ status: 'published' })
      const created = await Track.create({ group_id: space.id })
      track = await Track.where({ id: created.id }).fetch()
      await space.save({ track_id: track.id }, { patch: true })
    })

    it('counts an enrollment once through Track.enroll and tells the stewards', async () => {
      await Track.enroll(track.id, member.id)

      expect((await reloadTrack(track)).get('num_people_enrolled')).to.equal(1)
      const notices = await enrollmentNotices(track)
      expect(notices).to.have.length(1)
      expect(String(notices[0].reader_id)).to.equal(String(steward.id))
      expect(String(notices[0].actor_id)).to.equal(String(member.id))
    })

    it('counts an enrollment once through joinSpace', async () => {
      await joinSpace(member.id, space.id)

      expect((await reloadTrack(track)).get('num_people_enrolled')).to.equal(1)
      expect(await enrollmentNotices(track)).to.have.length(1)
    })

    it('counts an enrollment once through a checkout grant', async () => {
      const offering = await StripeProduct.create({
        group_id: parent.id,
        stripe_product_id: 'prod_settle_join',
        stripe_price_id: 'price_settle_join',
        name: 'Track Pass',
        description: 'track',
        price_in_cents: 1000,
        currency: 'usd',
        renewal_policy: 'manual',
        duration: 'month',
        access_grants: { groupIds: [space.id] },
        publish_status: 'published'
      })

      const grant = await grantCheckoutSessionAccess({
        id: 'cs_settle_join',
        payment_status: 'paid',
        metadata: { userId: String(member.id), groupId: String(parent.id), offeringId: String(offering.id) }
      })

      expect(grant.granted).to.equal(true)
      expect((await reloadTrack(track)).get('num_people_enrolled')).to.equal(1)
    })

    it('counts auto-added members once, without telling the stewards', async () => {
      const other = await factories.user().save()
      await parent.addMembers([other.id])
      await space.addSetting({ auto_add_members: true }, true)

      await Group.addEligibleMembersToSpace({ spaceId: space.id })

      expect((await reloadTrack(track)).get('num_people_enrolled')).to.equal(3)
      expect(await enrollmentNotices(track)).to.have.length(0)
    })

    it('stays consistent when someone leaves and enrolls again, starting a fresh enrollment', async () => {
      await Track.enroll(track.id, member.id)
      const membership = await membershipOf(member, space)
      await membership.addSetting({ completedAt: new Date().toISOString() }, true)

      await Track.leave(track.id, member.id)
      expect((await reloadTrack(track)).get('num_people_enrolled')).to.equal(0)

      await Track.enroll(track.id, member.id)
      expect((await reloadTrack(track)).get('num_people_enrolled')).to.equal(1)
      expect((await membershipOf(member, space)).getSetting('completedAt')).to.equal(undefined)
    })
  })

  describe('in a funding round space', () => {
    let space, round

    const makeRound = async (attrs = {}) => {
      space = await makeSpace({ status: FundingRound.PHASES.VOTING })
      round = await FundingRound.forge({
        group_id: space.id,
        created_at: new Date(),
        updated_at: new Date(),
        allow_late_joiners: true,
        voting_method: 'token_allocation_constant',
        total_tokens: 10,
        ...attrs
      }).save()
      await space.save({ funding_round_id: round.id }, { patch: true })
    }

    it('gives a late joiner tokens when the round allows it and is in voting', async () => {
      await makeRound()

      await joinSpace(member.id, space.id)

      expect((await membershipOf(member, space)).getSetting('tokensRemaining')).to.equal(10)
      expect((await reloadRound(round)).get('num_participants')).to.equal(1)
    })

    it('gives no tokens when the round does not allow late joiners', async () => {
      await makeRound({ allow_late_joiners: false })

      await FundingRound.join(round.id, member.id)

      expect((await membershipOf(member, space)).getSetting('tokensRemaining')).to.equal(undefined)
      expect((await reloadRound(round)).get('num_participants')).to.equal(1)
    })

    it('gives no tokens before voting opens', async () => {
      await makeRound()
      await space.save({ status: FundingRound.PHASES.SUBMISSIONS }, { patch: true })

      await FundingRound.join(round.id, member.id)

      expect((await membershipOf(member, space)).getSetting('tokensRemaining')).to.equal(undefined)
    })

    it('counts a participant once through FundingRound.join and stays consistent after leave and rejoin', async () => {
      await makeRound()

      await FundingRound.join(round.id, member.id)
      expect((await reloadRound(round)).get('num_participants')).to.equal(1)

      await FundingRound.leave(round.id, member.id)
      expect((await reloadRound(round)).get('num_participants')).to.equal(0)

      await FundingRound.join(round.id, member.id)
      expect((await reloadRound(round)).get('num_participants')).to.equal(1)
      expect((await membershipOf(member, space)).getSetting('tokensRemaining')).to.equal(10)
    })

    it('counts the creator who joins when a round is created for a space', async () => {
      space = await makeSpace({ status: 'published' })

      round = await FundingRound.create({ group_id: space.id, total_tokens: 10 }, member.id)

      expect(String((await Group.find(space.id)).get('funding_round_id'))).to.equal(String(round.id))
      expect((await reloadRound(round)).get('num_participants')).to.equal(1)
    })
  })
})
