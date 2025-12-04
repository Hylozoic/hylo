import '../../../test/setup'
import factories from '../../../test/setup/factories'
import {
  createFundingRound,
  updateFundingRound,
  deleteFundingRound,
  joinFundingRound,
  leaveFundingRound,
  doPhaseTransition,
  allocateTokensToSubmission
} from './fundingRound'

describe('createFundingRound', () => {
  let user, moderatorUser, group, responsibility

  beforeEach(async function () {
    user = factories.user()
    moderatorUser = factories.user()
    group = factories.group()
    await Promise.all([user.save(), moderatorUser.save(), group.save()])

    // Create the RESP_MANAGE_ROUNDS responsibility if it doesn't exist
    responsibility = await Responsibility.where({ title: Responsibility.constants.RESP_MANAGE_ROUNDS }).fetch()
    if (!responsibility) {
      responsibility = await new Responsibility({
        title: Responsibility.constants.RESP_MANAGE_ROUNDS,
        description: 'Can manage funding rounds',
        type: 'system'
      }).save()

      // Attach to Coordinator role (id: 1)
      const coordinatorRole = await CommonRole.where({ id: CommonRole.ROLES.Coordinator }).fetch()
      if (coordinatorRole) {
        await coordinatorRole.responsibilities().attach(responsibility.id)
      }
    }

    // Join group and give moderator the Coordinator role which has RESP_MANAGE_ROUNDS
    await moderatorUser.joinGroup(group)
    await new MemberCommonRole({
      user_id: moderatorUser.id,
      group_id: group.id,
      common_role_id: CommonRole.ROLES.Coordinator
    }).save()
  })

  it('creates a funding round with required fields', async () => {
    const data = {
      title: 'Community Grants 2024',
      groupId: group.id,
      description: 'A round for community projects',
      criteria: 'Must benefit the community',
      publishedAt: new Date(Date.now() - 1000).getTime().toString() // Set published_at so creator can join
    }

    const round = await createFundingRound(moderatorUser.id, data)
    expect(round).to.exist
    expect(round.get('title')).to.equal(data.title)
    expect(round.get('group_id')).to.equal(group.id)
  })

  it('throws error when title is missing', async () => {
    const data = { groupId: group.id }

    try {
      await createFundingRound(moderatorUser.id, data)
      expect.fail('should reject')
    } catch (e) {
      expect(e.message).to.match(/title is required/)
    }
  })

  it('throws error when groupId is missing', async () => {
    const data = { title: 'Test Round' }

    try {
      await createFundingRound(moderatorUser.id, data)
      expect.fail('should reject')
    } catch (e) {
      expect(e.message).to.match(/groupId is required/)
    }
  })

  it('throws error when group does not exist', async () => {
    const data = { title: 'Test Round', groupId: 999999 }

    try {
      await createFundingRound(moderatorUser.id, data)
      expect.fail('should reject')
    } catch (e) {
      expect(e.message).to.match(/Invalid group/)
    }
  })

  it('throws error when user does not have permission', async () => {
    const data = { title: 'Test Round', groupId: group.id }

    try {
      await createFundingRound(user.id, data)
      expect.fail('should reject')
    } catch (e) {
      expect(e.message).to.match(/You do not have permission to create funding rounds/)
    }
  })

  it('creates a funding round with date fields', async () => {
    const publishedAt = new Date('2024-01-01').getTime()
    const submissionsOpenAt = new Date('2024-01-15').getTime()
    const data = {
      title: 'Test Round',
      groupId: group.id,
      publishedAt: publishedAt.toString(),
      submissionsOpenAt: submissionsOpenAt.toString()
    }

    const round = await createFundingRound(moderatorUser.id, data)
    expect(round.get('published_at')).to.be.an.instanceof(Date)
    expect(round.get('submissions_open_at')).to.be.an.instanceof(Date)
  })

  it('creates a funding round with role restrictions', async () => {
    const data = {
      title: 'Test Round',
      groupId: group.id,
      submitterRoles: [{ type: 'common', id: 1 }],
      voterRoles: [{ type: 'common', id: 2 }],
      publishedAt: new Date(Date.now() - 1000).getTime().toString() // Set published_at so creator can join
    }

    const round = await createFundingRound(moderatorUser.id, data)
    const submitterRoles = round.get('submitter_roles')
    const voterRoles = round.get('voter_roles')
    // The roles are stored as JSON strings, so parse them if they're strings
    const parsedSubmitterRoles = typeof submitterRoles === 'string' ? JSON.parse(submitterRoles) : submitterRoles
    const parsedVoterRoles = typeof voterRoles === 'string' ? JSON.parse(voterRoles) : voterRoles
    expect(parsedSubmitterRoles).to.deep.equal(data.submitterRoles)
    expect(parsedVoterRoles).to.deep.equal(data.voterRoles)
  })
})

describe('updateFundingRound', () => {
  let user, moderatorUser, group, round, responsibility

  beforeEach(async function () {
    user = factories.user()
    moderatorUser = factories.user()
    group = factories.group()
    await Promise.all([user.save(), moderatorUser.save(), group.save()])

    // Create the RESP_MANAGE_ROUNDS responsibility if it doesn't exist
    responsibility = await Responsibility.where({ title: Responsibility.constants.RESP_MANAGE_ROUNDS }).fetch()
    if (!responsibility) {
      responsibility = await new Responsibility({
        title: Responsibility.constants.RESP_MANAGE_ROUNDS,
        description: 'Can manage funding rounds',
        type: 'system'
      }).save()

      // Attach to Coordinator role (id: 1)
      const coordinatorRole = await CommonRole.where({ id: CommonRole.ROLES.Coordinator }).fetch()
      if (coordinatorRole) {
        await coordinatorRole.responsibilities().attach(responsibility.id)
      }
    }

    await moderatorUser.joinGroup(group)
    await new MemberCommonRole({
      user_id: moderatorUser.id,
      group_id: group.id,
      common_role_id: CommonRole.ROLES.Coordinator
    }).save()

    // Create a funding round
    round = await new FundingRound({
      title: 'Original Title',
      group_id: group.id,
      phase: FundingRound.PHASES.DRAFT,
      voting_method: 'token_allocation_constant'
    }).save()
  })

  it('updates a funding round title', async () => {
    const data = { title: 'Updated Title' }

    const updatedRound = await updateFundingRound(moderatorUser.id, round.id, data)
    expect(updatedRound.get('title')).to.equal('Updated Title')
  })

  it('updates funding round dates', async () => {
    const publishedAt = new Date('2024-01-01').getTime()
    const data = { publishedAt: publishedAt.toString() }

    const updatedRound = await updateFundingRound(moderatorUser.id, round.id, data)
    expect(updatedRound.get('published_at')).to.be.an.instanceof(Date)
  })

  it('updates role restrictions', async () => {
    const data = {
      submitterRoles: [{ type: 'common', id: 1 }],
      voterRoles: [{ type: 'common', id: 2 }]
    }

    const updatedRound = await updateFundingRound(moderatorUser.id, round.id, data)
    const submitterRoles = updatedRound.get('submitter_roles')
    const voterRoles = updatedRound.get('voter_roles')
    // The roles are stored as JSON strings, so parse them if they're strings
    const parsedSubmitterRoles = typeof submitterRoles === 'string' ? JSON.parse(submitterRoles) : submitterRoles
    const parsedVoterRoles = typeof voterRoles === 'string' ? JSON.parse(voterRoles) : voterRoles
    expect(parsedSubmitterRoles).to.deep.equal(data.submitterRoles)
    expect(parsedVoterRoles).to.deep.equal(data.voterRoles)
  })

  it('throws error when round does not exist', async () => {
    const data = { title: 'Updated Title' }

    try {
      await updateFundingRound(moderatorUser.id, 999999, data)
      expect.fail('should reject')
    } catch (e) {
      expect(e.message).to.match(/FundingRound not found/)
    }
  })

  it('throws error when user does not have permission', async () => {
    const data = { title: 'Updated Title' }

    try {
      await updateFundingRound(user.id, round.id, data)
      expect.fail('should reject')
    } catch (e) {
      expect(e.message).to.match(/You do not have permission to update funding rounds/)
    }
  })

  it('triggers phase transition on update', async () => {
    const now = new Date()
    const pastDate = new Date(now.getTime() - 1000).getTime() // 1 second ago
    const data = { publishedAt: pastDate.toString() }

    const updatedRound = await updateFundingRound(moderatorUser.id, round.id, data)
    // Refetch to get latest phase
    const freshRound = await FundingRound.find(round.id)
    expect(freshRound.get('phase')).to.equal(FundingRound.PHASES.PUBLISHED)
  })
})

describe('deleteFundingRound', () => {
  let user, moderatorUser, group, round, responsibility

  beforeEach(async function () {
    user = factories.user()
    moderatorUser = factories.user()
    group = factories.group()
    await Promise.all([user.save(), moderatorUser.save(), group.save()])

    // Create the RESP_MANAGE_ROUNDS responsibility if it doesn't exist
    responsibility = await Responsibility.where({ title: Responsibility.constants.RESP_MANAGE_ROUNDS }).fetch()
    if (!responsibility) {
      responsibility = await new Responsibility({
        title: Responsibility.constants.RESP_MANAGE_ROUNDS,
        description: 'Can manage funding rounds',
        type: 'system'
      }).save()

      // Attach to Coordinator role (id: 1)
      const coordinatorRole = await CommonRole.where({ id: CommonRole.ROLES.Coordinator }).fetch()
      if (coordinatorRole) {
        await coordinatorRole.responsibilities().attach(responsibility.id)
      }
    }

    await moderatorUser.joinGroup(group)
    await new MemberCommonRole({
      user_id: moderatorUser.id,
      group_id: group.id,
      common_role_id: CommonRole.ROLES.Coordinator
    }).save()

    // Create a funding round
    round = await new FundingRound({
      title: 'Test Round',
      group_id: group.id,
      phase: FundingRound.PHASES.DRAFT,
      voting_method: 'token_allocation_constant'
    }).save()
  })

  it('soft deletes a funding round', async () => {
    const result = await deleteFundingRound(moderatorUser.id, round.id)
    expect(result.success).to.be.true

    // FundingRound.find excludes deactivated rounds, so we need to query directly
    const deletedRound = await FundingRound.where({ id: round.id }).fetch()
    expect(deletedRound.get('deactivated_at')).to.be.an.instanceof(Date)
  })

  it('throws error when round does not exist', async () => {
    try {
      await deleteFundingRound(moderatorUser.id, 999999)
      expect.fail('should reject')
    } catch (e) {
      expect(e.message).to.match(/FundingRound not found/)
    }
  })

  it('throws error when user does not have permission', async () => {
    try {
      await deleteFundingRound(user.id, round.id)
      expect.fail('should reject')
    } catch (e) {
      expect(e.message).to.match(/You do not have permission to delete funding rounds/)
    }
  })
})

describe('joinFundingRound', () => {
  let user, group, round

  beforeEach(async function () {
    user = factories.user()
    group = factories.group()
    await Promise.all([user.save(), group.save()])

    // User must be a member of the group
    await user.joinGroup(group)

    // Create a funding round with published_at set
    round = await new FundingRound({
      title: 'Test Round',
      group_id: group.id,
      phase: FundingRound.PHASES.PUBLISHED,
      published_at: new Date(Date.now() - 1000),
      voting_method: 'token_allocation_constant'
    }).save()
  })

  it('allows a user to join a funding round', async () => {
    const updatedRound = await joinFundingRound(user.id, round.id)

    const isParticipating = await updatedRound.isParticipating(user.id)
    expect(isParticipating).to.be.true
  })

  it('creates a FundingRoundUser record', async () => {
    await joinFundingRound(user.id, round.id)

    const roundUser = await FundingRoundUser.where({
      user_id: user.id,
      funding_round_id: round.id
    }).fetch()

    expect(roundUser).to.exist
  })
})

describe('leaveFundingRound', () => {
  let user, group, round

  beforeEach(async function () {
    user = factories.user()
    group = factories.group()
    await Promise.all([user.save(), group.save()])

    // User must be a member of the group
    await user.joinGroup(group)

    // Create a funding round with published_at set
    round = await new FundingRound({
      title: 'Test Round',
      group_id: group.id,
      phase: FundingRound.PHASES.PUBLISHED,
      published_at: new Date(Date.now() - 1000),
      voting_method: 'token_allocation_constant'
    }).save()

    // Join the round first
    await FundingRound.join(round.id, user.id)
  })

  it('allows a user to leave a funding round', async () => {
    const updatedRound = await leaveFundingRound(user.id, round.id)

    const isParticipating = await updatedRound.isParticipating(user.id)
    expect(isParticipating).to.be.false
  })

  it('removes the FundingRoundUser record', async () => {
    await leaveFundingRound(user.id, round.id)

    const roundUser = await FundingRoundUser.where({
      user_id: user.id,
      funding_round_id: round.id
    }).fetch()

    expect(roundUser).to.not.exist
  })
})

describe('doPhaseTransition', () => {
  let user, group, round

  beforeEach(async function () {
    user = factories.user()
    group = factories.group()
    await Promise.all([user.save(), group.save()])
  })

  it('transitions from DRAFT to PUBLISHED when publishedAt passes', async () => {
    const pastDate = new Date(Date.now() - 1000) // 1 second ago
    round = await new FundingRound({
      title: 'Test Round',
      group_id: group.id,
      phase: FundingRound.PHASES.DRAFT,
      published_at: pastDate,
      voting_method: 'token_allocation_constant'
    }).save()

    await doPhaseTransition(user.id, round.id)

    const updatedRound = await FundingRound.find(round.id)
    expect(updatedRound.get('phase')).to.equal(FundingRound.PHASES.PUBLISHED)
  })

  it('transitions from PUBLISHED to SUBMISSIONS when submissionsOpenAt passes', async () => {
    const pastDate = new Date(Date.now() - 1000) // 1 second ago
    round = await new FundingRound({
      title: 'Test Round',
      group_id: group.id,
      phase: FundingRound.PHASES.PUBLISHED,
      published_at: new Date(Date.now() - 10000),
      submissions_open_at: pastDate,
      voting_method: 'token_allocation_constant'
    }).save()

    await doPhaseTransition(user.id, round.id)

    const updatedRound = await FundingRound.find(round.id)
    expect(updatedRound.get('phase')).to.equal(FundingRound.PHASES.SUBMISSIONS)
  })

  it('transitions from SUBMISSIONS to DISCUSSION when submissionsCloseAt passes', async () => {
    const pastDate = new Date(Date.now() - 1000) // 1 second ago
    round = await new FundingRound({
      title: 'Test Round',
      group_id: group.id,
      phase: FundingRound.PHASES.SUBMISSIONS,
      published_at: new Date(Date.now() - 20000),
      submissions_open_at: new Date(Date.now() - 10000),
      submissions_close_at: pastDate,
      voting_method: 'token_allocation_constant'
    }).save()

    await doPhaseTransition(user.id, round.id)

    const updatedRound = await FundingRound.find(round.id)
    expect(updatedRound.get('phase')).to.equal(FundingRound.PHASES.DISCUSSION)
  })

  it('transitions from DISCUSSION to VOTING when votingOpensAt passes', async () => {
    const pastDate = new Date(Date.now() - 1000) // 1 second ago
    round = await new FundingRound({
      title: 'Test Round',
      group_id: group.id,
      phase: FundingRound.PHASES.DISCUSSION,
      published_at: new Date(Date.now() - 30000),
      submissions_open_at: new Date(Date.now() - 20000),
      submissions_close_at: new Date(Date.now() - 10000),
      voting_opens_at: pastDate,
      voting_method: 'token_allocation_constant',
      total_tokens: 100 // Required for token distribution
    }).save()

    // Join a user to the round so token distribution has users
    await user.joinGroup(group)
    await FundingRound.join(round.id, user.id)

    await doPhaseTransition(user.id, round.id)

    const updatedRound = await FundingRound.find(round.id)
    expect(updatedRound.get('phase')).to.equal(FundingRound.PHASES.VOTING)
  })

  it('transitions from VOTING to COMPLETED when votingClosesAt passes', async () => {
    const pastDate = new Date(Date.now() - 1000) // 1 second ago
    round = await new FundingRound({
      title: 'Test Round',
      group_id: group.id,
      phase: FundingRound.PHASES.VOTING,
      published_at: new Date(Date.now() - 40000),
      submissions_open_at: new Date(Date.now() - 30000),
      submissions_close_at: new Date(Date.now() - 20000),
      voting_opens_at: new Date(Date.now() - 10000),
      voting_closes_at: pastDate,
      voting_method: 'token_allocation_constant'
    }).save()

    await doPhaseTransition(user.id, round.id)

    const updatedRound = await FundingRound.find(round.id)
    expect(updatedRound.get('phase')).to.equal(FundingRound.PHASES.COMPLETED)
  })

  it('does not transition if publishedAt is in the future', async () => {
    const futureDate = new Date(Date.now() + 10000) // 10 seconds from now
    round = await new FundingRound({
      title: 'Test Round',
      group_id: group.id,
      phase: FundingRound.PHASES.DRAFT,
      published_at: futureDate,
      voting_method: 'token_allocation_constant'
    }).save()

    await doPhaseTransition(user.id, round.id)

    const updatedRound = await FundingRound.find(round.id)
    expect(updatedRound.get('phase')).to.equal(FundingRound.PHASES.DRAFT)
  })

  it('transitions back from COMPLETED to VOTING when votingClosesAt is cleared', async () => {
    round = await new FundingRound({
      title: 'Test Round',
      group_id: group.id,
      phase: FundingRound.PHASES.COMPLETED,
      published_at: new Date(Date.now() - 40000),
      submissions_open_at: new Date(Date.now() - 30000),
      submissions_close_at: new Date(Date.now() - 20000),
      voting_opens_at: new Date(Date.now() - 10000),
      voting_closes_at: null,
      voting_method: 'token_allocation_constant'
    }).save()

    await doPhaseTransition(user.id, round.id)

    const updatedRound = await FundingRound.find(round.id)
    expect(updatedRound.get('phase')).to.equal(FundingRound.PHASES.VOTING)
  })

  it('transitions back from VOTING when votingOpensAt is cleared', async () => {
    round = await new FundingRound({
      title: 'Test Round',
      group_id: group.id,
      phase: FundingRound.PHASES.VOTING,
      published_at: new Date(Date.now() - 30000),
      submissions_open_at: new Date(Date.now() - 20000),
      submissions_close_at: new Date(Date.now() - 10000),
      voting_opens_at: null,
      voting_method: 'token_allocation_constant'
    }).save()

    await doPhaseTransition(user.id, round.id)

    const updatedRound = await FundingRound.find(round.id)
    expect(updatedRound.get('phase')).to.equal(FundingRound.PHASES.DISCUSSION)
  })

  it('throws error when round does not exist', async () => {
    try {
      await doPhaseTransition(user.id, 999999)
      expect.fail('should reject')
    } catch (e) {
      expect(e.message).to.match(/FundingRound not found/)
    }
  })
})

describe('allocateTokensToSubmission', () => {
  let user, group, round, submission, voter

  beforeEach(async function () {
    user = factories.user()
    voter = factories.user()
    group = factories.group()
    await Promise.all([user.save(), voter.save(), group.save()])

    // Voter must be a member of the group
    await voter.joinGroup(group)

    // Create a funding round in voting phase
    round = await new FundingRound({
      title: 'Test Round',
      group_id: group.id,
      phase: FundingRound.PHASES.VOTING,
      published_at: new Date(Date.now() - 40000),
      submissions_open_at: new Date(Date.now() - 30000),
      submissions_close_at: new Date(Date.now() - 20000),
      voting_opens_at: new Date(Date.now() - 10000),
      voting_method: 'token_allocation_constant'
    }).save()

    // Create a submission
    submission = factories.post({ type: Post.Type.SUBMISSION })
    await submission.save()
    await group.posts().attach(submission)

    // Link submission to funding round
    await bookshelf.knex('funding_rounds_posts').insert({
      funding_round_id: round.id,
      post_id: submission.id
    })

    // Have voter join the round
    await FundingRound.join(round.id, voter.id)

    // Update the voter's FundingRoundUser record with tokens
    await FundingRoundUser.where({
      user_id: voter.id,
      funding_round_id: round.id
    }).fetch().then(roundUser => roundUser.save({
      tokens_remaining: 100
    }))
  })

  it('allows a user to allocate tokens to a submission', async () => {
    const result = await allocateTokensToSubmission(voter.id, submission.id, 50)

    expect(result).to.exist

    // Check that tokens were allocated
    const postUser = await PostUser.find(submission.id, voter.id)
    expect(postUser.get('tokens_allocated_to')).to.equal(50)

    // Check that remaining tokens were updated
    const roundUser = await FundingRoundUser.where({
      user_id: voter.id,
      funding_round_id: round.id
    }).fetch()
    expect(roundUser.get('tokens_remaining')).to.equal(50)
  })

  it('updates existing token allocation', async () => {
    // First allocation
    await allocateTokensToSubmission(voter.id, submission.id, 30)

    // Update allocation
    await allocateTokensToSubmission(voter.id, submission.id, 50)

    const postUser = await PostUser.find(submission.id, voter.id)
    expect(postUser.get('tokens_allocated_to')).to.equal(50)

    const roundUser = await FundingRoundUser.where({
      user_id: voter.id,
      funding_round_id: round.id
    }).fetch()
    expect(roundUser.get('tokens_remaining')).to.equal(50)
  })

  it('allows reducing token allocation', async () => {
    // First allocation
    await allocateTokensToSubmission(voter.id, submission.id, 80)

    // Reduce allocation
    await allocateTokensToSubmission(voter.id, submission.id, 30)

    const postUser = await PostUser.find(submission.id, voter.id)
    expect(postUser.get('tokens_allocated_to')).to.equal(30)

    const roundUser = await FundingRoundUser.where({
      user_id: voter.id,
      funding_round_id: round.id
    }).fetch()
    expect(roundUser.get('tokens_remaining')).to.equal(70)
  })

  it('throws error when postId is missing', async () => {
    try {
      await allocateTokensToSubmission(voter.id, null, 50)
      expect.fail('should reject')
    } catch (e) {
      expect(e.message).to.match(/postId is required/)
    }
  })

  it('throws error when tokens is missing', async () => {
    try {
      await allocateTokensToSubmission(voter.id, submission.id, null)
      expect.fail('should reject')
    } catch (e) {
      expect(e.message).to.match(/tokens is required/)
    }
  })

  it('throws error when tokens is negative', async () => {
    try {
      await allocateTokensToSubmission(voter.id, submission.id, -10)
      expect.fail('should reject')
    } catch (e) {
      expect(e.message).to.match(/tokens must be non-negative/)
    }
  })

  it('throws error when post does not exist', async () => {
    try {
      await allocateTokensToSubmission(voter.id, 999999, 50)
      expect.fail('should reject')
    } catch (e) {
      expect(e.message).to.match(/Post not found/)
    }
  })

  it('throws error when post is not a submission', async () => {
    const regularPost = factories.post({ type: Post.Type.DISCUSSION })
    await regularPost.save()

    try {
      await allocateTokensToSubmission(voter.id, regularPost.id, 50)
      expect.fail('should reject')
    } catch (e) {
      expect(e.message).to.match(/Post must be a submission/)
    }
  })

  it('throws error when post is not part of a funding round', async () => {
    const orphanSubmission = factories.post({ type: Post.Type.SUBMISSION })
    await orphanSubmission.save()

    try {
      await allocateTokensToSubmission(voter.id, orphanSubmission.id, 50)
      expect.fail('should reject')
    } catch (e) {
      expect(e.message).to.match(/Post is not part of a funding round/)
    }
  })

  it('throws error when user is not participating in round', async () => {
    try {
      await allocateTokensToSubmission(user.id, submission.id, 50)
      expect.fail('should reject')
    } catch (e) {
      expect(e.message).to.match(/You must be participating in this round to allocate tokens/)
    }
  })

  it('throws error when user does not have enough tokens', async () => {
    try {
      await allocateTokensToSubmission(voter.id, submission.id, 150)
      expect.fail('should reject')
    } catch (e) {
      expect(e.message).to.match(/Not enough tokens remaining/)
    }
  })

  it('throws error when voting has not started', async () => {
    // Create a round in submissions phase
    const draftRound = await new FundingRound({
      title: 'Draft Round',
      group_id: group.id,
      phase: FundingRound.PHASES.SUBMISSIONS,
      published_at: new Date(Date.now() - 1000), // Set published_at so user can join
      voting_method: 'token_allocation_constant'
    }).save()

    const draftSubmission = factories.post({ type: Post.Type.SUBMISSION })
    await draftSubmission.save()

    await bookshelf.knex('funding_rounds_posts').insert({
      funding_round_id: draftRound.id,
      post_id: draftSubmission.id
    })

    await FundingRound.join(draftRound.id, voter.id)

    try {
      await allocateTokensToSubmission(voter.id, draftSubmission.id, 50)
      expect.fail('should reject')
    } catch (e) {
      expect(e.message).to.match(/Voting has not started yet/)
    }
  })

  it('allows allocation to zero tokens', async () => {
    // First allocate some tokens
    await allocateTokensToSubmission(voter.id, submission.id, 50)

    // Then set to zero
    const result = await allocateTokensToSubmission(voter.id, submission.id, 0)

    expect(result).to.exist

    const postUser = await PostUser.find(submission.id, voter.id)
    expect(postUser.get('tokens_allocated_to')).to.equal(0)

    const roundUser = await FundingRoundUser.where({
      user_id: voter.id,
      funding_round_id: round.id
    }).fetch()
    expect(roundUser.get('tokens_remaining')).to.equal(100)
  })
})

