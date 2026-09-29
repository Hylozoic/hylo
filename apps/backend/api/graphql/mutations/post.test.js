/* eslint-disable no-unused-expressions */
import setup from '../../../test/setup'
import factories from '../../../test/setup/factories'
import { assignAdministrator } from '../../../test/setup/roleHelpers'
import RedisClient from '../../services/RedisClient'
import { pinPost, removeProposalVote, addProposalVote, swapProposalVote, setProposalOptions, updateProposalOptions, updateProposalOutcome, deletePost, fulfillPost, unfulfillPost, followPost, unfollowPost } from './post'
import { mockify, spyify, unspyify } from '../../../test/setup/helpers'

describe('pinPost', () => {
  var user, group, post, view

  before(function () {
    user = factories.user()
    group = factories.group()
    post = factories.post()
    return Promise.join(group.save(), user.save(), post.save())
      .then(() => group.posts().attach(post))
      .then(() => user.joinGroup(group, { assignAdministrator: true }))
      .then(() => GroupView.forge({
        group_id: group.id,
        type: GroupView.Type.ALL,
        order: 0
      }).save())
      .then(v => { view = v })
  })

  it('pins a post to the view', () => {
    return pinPost(user.id, post.id, view.id)
      .then(() => GroupViewPin.find(view.id, post.id))
      .then(pin => {
        expect(pin).to.exist
        expect(pin.get('pinned_at').getTime()).to.be.closeTo(new Date().getTime(), 2000)
      })
  })

  it('unpins a post when already pinned', () => {
    return pinPost(user.id, post.id, view.id)
      .then(() => GroupViewPin.find(view.id, post.id))
      .then(pin => {
        expect(pin).to.equal(null)
      })
  })

  it('rejects if user is not a moderator', () => {
    return pinPost('777', post.id, view.id)
      .then(() => expect.fail('should reject'))
      .catch(e => expect(e.message).to.match(/don't have permission/))
  })

  it("rejects if the post is not in the view's group", () => {
    return pinPost(user.id, '919191', view.id)
      .then(() => expect.fail('should reject'))
      .catch(e => expect(e.message).to.match(/Couldn't find post in this group/))
  })

  it('rejects a fourth pin', async () => {
    const capView = await GroupView.forge({
      group_id: group.id,
      type: GroupView.Type.DISCUSSIONS,
      order: 1
    }).save()
    const extra = []
    for (let i = 0; i < 3; i++) {
      extra.push(await factories.post().save())
    }
    await group.posts().attach(extra)
    for (const p of extra) {
      await pinPost(user.id, p.id, capView.id)
    }
    const fourth = await factories.post().save()
    await group.posts().attach(fourth)
    try {
      await pinPost(user.id, fourth.id, capView.id)
      expect.fail('should reject')
    } catch (e) {
      expect(e.message).to.match(/up to 3 posts/)
    }
  })
})

describe('ProposalVote', () => {
  var user, post, option1, option2, option3, option4, option5, optionId, optionId2, g1

  before(function () {
    user = factories.user()
    post = factories.post({ type: 'proposal' })
    g1 = factories.group({ active: true })
    return Promise.join(user.save(), post.save(), g1.save())
      .then(() => user.joinGroup(g1))
      .then(() => post.groups().attach(g1.id))
      .then(async () => {
        option1 = { post_id: post.id, text: 'option1' }
        option2 = { post_id: post.id, text: 'option2' }
        option3 = { post_id: post.id, text: 'third' }
        option4 = { post_id: post.id, text: 'fourth' }
        option5 = { post_id: post.id, text: 'five' }
        await post.save({ proposal_status: Post.Proposal_Status.DISCUSSION }, { patch: true })

        return post.setProposalOptions({ options: [option1, option2] })
      })
      .then(async (result) => {
        const rows = result.filter((res) => (res.command === 'INSERT'))[0].rows
        optionId = rows[0].id
        optionId2 = rows[1].id
        await post.save({ proposal_status: Post.Proposal_Status.VOTING }, { patch: true })
      })
  })

  it('adds a vote', () => {
    return addProposalVote({ userId: user.id, postId: post.id, optionId })
      .then(() => post.proposalVotes().fetch())
      .then(votes => {
        expect(votes.length).to.equal(1)
      })
  })

  it('removes the vote', async () => {
    // Remove the vote that was added in "adds a vote" test
    await removeProposalVote({ userId: user.id, postId: post.id, optionId })
    const votes = await post.proposalVotes().fetch()
    expect(votes.length).to.equal(0)
  })

  it('swaps a vote', () => {
    return swapProposalVote({ userId: user.id, postId: post.id, removeOptionId: optionId, addOptionId: optionId2 })
      .then(() => post.proposalVotes().fetch())
      .then(votes => {
        expect(parseInt(votes.models[0].attributes.option_id)).to.equal(optionId2)
      })
  })

  it('rejects if user is not authorized', () => {
    return addProposalVote({ userId: '777', postId: post.id, optionId })
      .then(() => expect.fail('should reject'))
      .catch(e => expect(e).to.match(/You don't have permission to vote on this post/))
  })

  it('allows the proposal options to be set', async () => {
    await removeProposalVote({ userId: user.id, postId: post.id, optionId: optionId2 })
    await post.save({ proposal_status: Post.Proposal_Status.DISCUSSION }, { patch: true })
    return setProposalOptions({ userId: user.id, postId: post.id, options: [option3, option4] })
      .then(() => post.proposalOptions().fetch())
      .then(options => {
        expect(options.models[0].attributes.text).to.equal(option3.text)
      })
  })

  it('allows the proposal options to be updated', async () => {
    await post.save({ proposal_status: Post.Proposal_Status.DISCUSSION }, { patch: true })
    const currentOptions = await post.proposalOptions().fetch()
    const option3Model = currentOptions.models[0]
    return updateProposalOptions({ userId: user.id, postId: post.id, options: [{ id: option3Model.get('id'), text: option3Model.get('text') }, option5] })
      .then(() => post.proposalOptions().fetch())
      .then(options => {
        expect(options.models[0].attributes.text).to.equal(option3.text)
        expect(options.models[1].attributes.text).to.equal(option5.text)
      })
  })

  it('does not allow proposal options to be updated if the proposal_status is not "discussion"', async () => {
    await post.save({ proposal_status: Post.Proposal_Status.VOTING }, { patch: true })
    return setProposalOptions({ userId: user.id, postId: post.id, options: [option1, option2] })
      .then(() => expect.fail('should reject'))
      .catch(e => expect(e).to.match(/Proposal options cannot be changed unless the proposal is in 'discussion'/))
  })

  it('does not allow adding a vote if the proposal_status is not "voting"', async () => {
    await post.save({ proposal_status: Post.Proposal_Status.COMPLETED }, { patch: true })
    return addProposalVote({ userId: user.id, postId: post.id, optionId })
      .then(() => expect.fail('should reject'))
      .catch(e => expect(e).to.match(/Cannot vote on a proposal that is in discussion or completed/))
  })

  it('does not allow removing a vote if the proposal_status is not "voting"', async () => {
    await post.save({ proposal_status: Post.Proposal_Status.COMPLETED }, { patch: true })
    return removeProposalVote({ userId: user.id, postId: post.id, optionId })
      .then(() => expect.fail('should reject'))
      .catch(e => expect(e).to.match(/Cannot vote on a proposal that is in discussion or completed/))
  })

  it('does not allow swapping a vote if the proposal_status is not "voting"', async () => {
    await post.save({ proposal_status: Post.Proposal_Status.COMPLETED }, { patch: true })
    return swapProposalVote({ userId: user.id, postId: post.id, removeOptionId: optionId, addOptionId: optionId2 })
      .then(() => expect.fail('should reject'))
      .catch(e => expect(e).to.match(/Cannot vote on a proposal that is in discussion or completed/))
  })
})

describe('deletePost', () => {
  let user

  before(async () => {
    await setup.clearDb()
    user = await factories.user().save()
  })

  beforeEach(() => {
    spyify(Queue, 'classMethod', () => Promise.resolve())
    spyify(Post, 'deactivate', () => Promise.resolve())
  })

  afterEach(() => {
    unspyify(Queue, 'classMethod')
    unspyify(Post, 'deactivate')
  })

  it('queues processEventDeleted when deleting an event post', async () => {
    const eventPost = await factories.post({
      type: Post.Type.EVENT,
      user_id: user.id
    }).save()

    await deletePost(user.id, eventPost.id)

    expect(Queue.classMethod).to.have.been.called
    expect(Queue.classMethod).to.have.been.called.with(
      'Post',
      'processEventDeleted',
      { postId: eventPost.id }
    )
  })

  it('does not queue processEventDeleted when deleting a regular post', async () => {
    const regularPost = await factories.post({
      type: Post.Type.DISCUSSION,
      user_id: user.id
    }).save()

    await deletePost(user.id, regularPost.id)

    expect(Queue.classMethod).to.not.have.been.called
  })

  it('calls Post.deactivate for both event and regular posts', async () => {
    const eventPost = await factories.post({
      type: Post.Type.EVENT,
      user_id: user.id
    }).save()
    const regularPost = await factories.post({
      type: Post.Type.DISCUSSION,
      user_id: user.id
    }).save()

    await deletePost(user.id, eventPost.id)
    expect(Post.deactivate).to.have.been.called.with(eventPost.id)

    await deletePost(user.id, regularPost.id)
    expect(Post.deactivate).to.have.been.called.with(regularPost.id)
  })

  it('returns success: true after deletion', async () => {
    const eventPost = await factories.post({
      type: Post.Type.EVENT,
      user_id: user.id
    }).save()

    const result = await deletePost(user.id, eventPost.id)
    expect(result).to.deep.equal({ success: true })
  })

  it('throws error if post does not exist', async () => {
    try {
      await deletePost(user.id, '99999')
      expect.fail('should reject')
    } catch (e) {
      expect(e.message).to.equal('Post does not exist')
    }
  })

  it('throws error if user does not have permission', async () => {
    const otherUser = await factories.user().save()
    const eventPost = await factories.post({
      type: Post.Type.EVENT,
      user_id: user.id
    }).save()

    try {
      await deletePost(otherUser.id, eventPost.id)
      expect.fail('should reject')
    } catch (e) {
      expect(e.message).to.equal("You don't have permission to modify this post")
    }
  })
})

describe('fulfillPost and unfulfillPost', () => {
  let author, moderator, otherUser, group, group2, requestPost, discussionPost

  before(async () => {
    await setup.clearDb()
    author = await factories.user().save()
    moderator = await factories.user().save()
    otherUser = await factories.user().save()
    group = await factories.group().save()
    group2 = await factories.group().save()
    await GroupRole.setupSystemRoles(group.id)
    await GroupRole.setupSystemRoles(group2.id)
    await author.joinGroup(group)
    await moderator.joinGroup(group)
    const moderatorRole = await GroupRole.findSystemRole(group.id, 'Moderator')
    await MemberGroupRole.forge({
      user_id: moderator.id,
      group_id: group.id,
      group_role_id: moderatorRole.id,
      active: true
    }).save()

    requestPost = await factories.post({ type: 'request', user_id: author.id }).save()
    await requestPost.groups().attach(group)
    discussionPost = await factories.post({ type: 'discussion', user_id: author.id }).save()
    await discussionPost.groups().attach(group)
  })

  beforeEach(() => {
    spyify(Queue, 'classMethod', () => Promise.resolve())
    // mockify, not spyify: a spy still runs the real save without awaiting it, and those
    // writes race the next describe's clearDb
    mockify(Activity, 'saveForReasons', (activities) => Promise.resolve(activities))
  })

  afterEach(() => {
    unspyify(Queue, 'classMethod')
    unspyify(Activity, 'saveForReasons')
  })

  it('allows the creator to fulfill a multi-group post', async () => {
    const multiGroupPost = await factories.post({ type: 'request', user_id: author.id }).save()
    await multiGroupPost.groups().attach([group.id, group2.id])

    const result = await fulfillPost(author.id, multiGroupPost.id)
    expect(result).to.deep.equal({ success: true })
    await multiGroupPost.refresh()
    expect(multiGroupPost.get('fulfilled_at')).to.exist
    expect(Queue.classMethod).to.have.been.called.with('Post', 'publishPostUpdates', { postId: multiGroupPost.id, options: { changeContext: 'completion' } })
    expect(Activity.saveForReasons).to.not.have.been.called
  })

  it('allows a moderator to fulfill a fulfillable post', async () => {
    await requestPost.save({ fulfilled_at: null }, { patch: true })

    const result = await fulfillPost(moderator.id, requestPost.id)
    expect(result).to.deep.equal({ success: true })
    await requestPost.refresh()
    expect(requestPost.get('fulfilled_at')).to.exist
    expect(Activity.saveForReasons).to.have.been.called
  })

  it('allows an administrator to fulfill a fulfillable post', async () => {
    const administrator = await factories.user().save()
    const g = await factories.group().save()
    await assignAdministrator(administrator, g)
    const offerPost = await factories.post({ type: 'offer', user_id: author.id }).save()
    await offerPost.groups().attach(g)

    const result = await fulfillPost(administrator.id, offerPost.id)
    expect(result).to.deep.equal({ success: true })
    await offerPost.refresh()
    expect(offerPost.get('fulfilled_at')).to.exist
  })

  it('allows a moderator to fulfill a multi-group post when they have responsibilities in any one group', async () => {
    const moderatorOneGroup = await factories.user().save()
    await moderatorOneGroup.joinGroup(group)
    const moderatorRoleOneGroup = await GroupRole.findSystemRole(group.id, 'Moderator')
    await MemberGroupRole.forge({
      user_id: moderatorOneGroup.id,
      group_id: group.id,
      group_role_id: moderatorRoleOneGroup.id,
      active: true
    }).save()

    const multiGroupPost = await factories.post({ type: 'offer', user_id: author.id }).save()
    await multiGroupPost.groups().attach([group.id, group2.id])

    const result = await fulfillPost(moderatorOneGroup.id, multiGroupPost.id)
    expect(result).to.deep.equal({ success: true })
    await multiGroupPost.refresh()
    expect(multiGroupPost.get('fulfilled_at')).to.exist
    expect(Activity.saveForReasons).to.have.been.called
  })

  it('rejects a moderator fulfilling a post when they have no responsibilities in any of its groups', async () => {
    const multiGroupPost = await factories.post({ type: 'offer', user_id: author.id }).save()
    await multiGroupPost.groups().attach([group.id, group2.id])

    try {
      await fulfillPost(otherUser.id, multiGroupPost.id)
      expect.fail('should reject')
    } catch (e) {
      expect(e.message).to.equal("You don't have permission to modify this post")
    }
  })

  it('rejects a user without moderation responsibilities', async () => {
    await requestPost.save({ fulfilled_at: null }, { patch: true })

    try {
      await fulfillPost(otherUser.id, requestPost.id)
      expect.fail('should reject')
    } catch (e) {
      expect(e.message).to.equal("You don't have permission to modify this post")
    }
  })

  it('rejects a moderator fulfilling a non-fulfillable post type', async () => {
    try {
      await fulfillPost(moderator.id, discussionPost.id)
      expect.fail('should reject')
    } catch (e) {
      expect(e.message).to.equal("You don't have permission to modify this post")
    }
  })

  it('does not notify the author when they fulfill their own post', async () => {
    const ownPost = await factories.post({ type: 'resource', user_id: author.id }).save()
    await ownPost.groups().attach(group)

    await fulfillPost(author.id, ownPost.id)
    expect(Activity.saveForReasons).to.not.have.been.called
  })

  it('allows a moderator to unfulfill a post and notifies the author', async () => {
    await requestPost.save({ fulfilled_at: new Date() }, { patch: true })

    const result = await unfulfillPost(moderator.id, requestPost.id)
    expect(result).to.deep.equal({ success: true })
    await requestPost.refresh()
    expect(requestPost.get('fulfilled_at')).to.not.exist
    expect(Queue.classMethod).to.have.been.called.with('Post', 'publishPostUpdates', { postId: requestPost.id, options: { changeContext: 'completion' } })
    expect(Activity.saveForReasons).to.have.been.called
  })
})

describe('followPost and unfollowPost', () => {
  let author, reader, outsider, group, post, originalEmailNotificationsEnabled

  const commentOnPost = async () => {
    const comment = await factories.comment({ post_id: post.id, user_id: author.id }).save()
    await comment.createActivities()
    return comment
  }

  const commentActivityFor = (comment, user) =>
    Activity.where({ comment_id: comment.id, reader_id: user.id }).fetch()

  const sendCommentDigests = async () => {
    await (await RedisClient.create()).del(Comment.sendDigests.REDIS_TIMESTAMP_KEY)
    await Comment.sendDigests()
  }

  const digestRecipients = () =>
    Email.sendCommentDigest.__spy.calls.map(([args]) => args.email)

  beforeEach(async () => {
    await setup.clearDb()
    originalEmailNotificationsEnabled = process.env.EMAIL_NOTIFICATIONS_ENABLED
    process.env.EMAIL_NOTIFICATIONS_ENABLED = 'true'
    mockify(Email, 'sendCommentDigest', () => Promise.resolve(true))

    author = await factories.user().save()
    reader = await factories.user({ settings: { comment_notifications: 'email' } }).save()
    outsider = await factories.user().save()
    group = await factories.group().save()
    await author.joinGroup(group)
    await reader.joinGroup(group)
    post = await factories.post({ type: 'discussion', user_id: author.id }).save()
    await post.groups().attach(group)
    await post.addFollowers([author.id, reader.id])
    await PostUser.find(post.id, reader.id).then(pu => pu.save({ saved_at: new Date() }, { patch: true }))
  })

  afterEach(() => {
    process.env.EMAIL_NOTIFICATIONS_ENABLED = originalEmailNotificationsEnabled
    unspyify(Email, 'sendCommentDigest')
  })

  it('removes the user from the followers but keeps their saved state', async () => {
    await unfollowPost(reader.id, post.id)

    const followerIds = (await post.followers().fetch()).pluck('id')
    expect(followerIds).to.not.include(reader.id)
    const postUser = await PostUser.find(post.id, reader.id)
    expect(postUser.get('active')).to.equal(true)
    expect(postUser.get('saved_at')).to.exist
  })

  it('stops comment activities and comment digests for the unfollower', async () => {
    await unfollowPost(reader.id, post.id)
    const comment = await commentOnPost()

    expect(await commentActivityFor(comment, reader)).to.not.exist
    await sendCommentDigests()
    expect(digestRecipients()).to.not.include(reader.get('email'))
  })

  it('restores comment activities and comment digests when following again', async () => {
    await unfollowPost(reader.id, post.id)
    await followPost(reader.id, post.id)
    const comment = await commentOnPost()

    const activity = await commentActivityFor(comment, reader)
    expect(activity.get('meta').reasons).to.include('newComment')
    await sendCommentDigests()
    expect(digestRecipients()).to.include(reader.get('email'))
  })

  it('rejects a post the user cannot see', async () => {
    await expect(unfollowPost(outsider.id, post.id)).to.be.rejectedWith('Post not found')
    await expect(followPost(outsider.id, post.id)).to.be.rejectedWith('Post not found')
    expect(await PostUser.find(post.id, outsider.id)).to.not.exist
  })

  it('rejects message threads', async () => {
    const thread = await factories.post({ type: Post.Type.THREAD, user_id: author.id }).save()
    await thread.addFollowers([author.id, reader.id])

    await expect(unfollowPost(reader.id, thread.id)).to.be.rejectedWith('Message threads can be muted but not unfollowed')
  })

  it('keeps a project member in the project when they unfollow it', async () => {
    const project = await factories.post({ type: Post.Type.PROJECT, user_id: author.id }).save()
    await project.groups().attach(group)
    await project.addProjectMembers([reader.id])

    await unfollowPost(reader.id, project.id)
    expect((await project.members().fetch()).pluck('id')).to.deep.equal([reader.id])
    expect((await project.followers().fetch()).pluck('id')).to.not.include(reader.id)

    await followPost(reader.id, project.id)
    expect((await project.members().fetch()).pluck('id')).to.deep.equal([reader.id])
    expect((await project.followers().fetch()).pluck('id')).to.include(reader.id)
  })
})

describe('updateProposalOutcome notices (D46)', () => {
  let author, voters, post

  const outcomeActivities = async () => (await Activity.query(q => {
    q.whereRaw("meta->'reasons' \\? 'proposalOutcome'")
  }).fetchAll()).models

  before(async () => {
    await setup.clearDb()
    author = await factories.user().save()
    voters = await Promise.all([1, 2].map(() => factories.user().save()))
    const group = await factories.group().save()
    await group.addMembers([author, ...voters])
    post = await factories.post({ user_id: author.id, type: 'proposal', proposal_status: Post.Proposal_Status.COMPLETED }).save()
    await group.posts().attach(post)
    const [option] = await bookshelf.knex('proposal_options').insert({ post_id: post.id, text: 'Yes' }).returning('id')
    for (const user of [...voters, author]) {
      await bookshelf.knex('proposal_votes').insert({ post_id: post.id, option_id: option.id || option, user_id: user.id, created_at: new Date() })
    }
  })

  beforeEach(() => spyify(Queue, 'classMethod', () => Promise.resolve()))
  afterEach(() => unspyify(Queue, 'classMethod'))

  it('tells the voters the first time the outcome is recorded, and only then', async () => {
    await updateProposalOutcome({ userId: author.id, postId: post.id, proposalOutcome: 'We paint it blue next month' })
    const activities = await outcomeActivities()
    expect(activities.map(a => String(a.get('reader_id'))).sort()).to.deep.equal(voters.map(v => String(v.id)).sort())
    expect(activities[0].get('meta').outcome).to.equal('We paint it blue next month')
    expect(String(activities[0].get('actor_id'))).to.equal(String(author.id))

    await updateProposalOutcome({ userId: author.id, postId: post.id, proposalOutcome: 'We paint it green' })
    expect(await outcomeActivities()).to.have.length(2)
  })

  it('does not notify when someone other than the author tries', async () => {
    await expect(updateProposalOutcome({ userId: voters[0].id, postId: post.id, proposalOutcome: 'No' }))
      .to.be.rejectedWith(/permission/)
  })
})

describe("fulfillPost: 'Who helped?' (D27)", () => {
  let author, helper, otherCommenter, follower, mutedFollower, bystander, group, request

  const activitiesWithReason = async (reason, where = {}) => (await Activity.query(q => {
    q.where(where)
    q.whereRaw("meta->'reasons' \\? ?", [reason])
  }).fetchAll()).models

  // Contribution.create queues the helper's notice; run the queued job here
  const runQueuedContributionJobs = async () => {
    const calls = Queue.classMethod.__spy.calls.filter(([className, method]) => className === 'Contribution' && method === 'createActivities')
    for (const [, , data] of calls) await Contribution.createActivities(data)
  }

  const follow = (user, attrs = {}) => request.addFollowers([user.id], attrs)

  before(async () => {
    await setup.clearDb()
    author = await factories.user({ name: 'Ada Author' }).save()
    helper = await factories.user({ name: 'Sam Helper' }).save()
    otherCommenter = await factories.user().save()
    follower = await factories.user().save()
    mutedFollower = await factories.user().save()
    bystander = await factories.user().save()
    group = await factories.group().save()
    await group.addMembers([author, helper, otherCommenter, follower, mutedFollower, bystander])
  })

  beforeEach(async () => {
    mockify(Queue, 'classMethod', () => Promise.resolve())
    request = await factories.post({ type: 'request', user_id: author.id, name: 'Need a ladder' }).save()
    await request.groups().attach(group)
    for (const user of [helper, otherCommenter]) {
      await factories.comment({ post_id: request.id, user_id: user.id }).save()
      await follow(user)
    }
    await follow(author)
    await follow(follower)
    await follow(mutedFollower, { muted_at: new Date() })
  })

  afterEach(() => unspyify(Queue, 'classMethod'))

  it('credits the helpers and tells them, in-app and by push', async () => {
    await fulfillPost(author.id, request.id, [helper.id])
    await runQueuedContributionJobs()

    const contributions = await Contribution.where({ post_id: request.id }).fetchAll()
    expect(contributions.pluck('user_id').map(String)).to.deep.equal([String(helper.id)])
    const [notice] = await activitiesWithReason('requestHelped', { post_id: request.id })
    expect(String(notice.get('reader_id'))).to.equal(String(helper.id))
    expect(String(notice.get('actor_id'))).to.equal(String(author.id))
    const media = (await Notification.where({ activity_id: notice.id }).fetchAll()).pluck('medium').sort()
    expect(media).to.deep.equal([Notification.MEDIUM.InApp, Notification.MEDIUM.Push])
  })

  it('tells followers the request was met, in-app only, leaving out the author, helpers and muted followers', async () => {
    await fulfillPost(author.id, request.id, [helper.id])

    const notices = await activitiesWithReason('requestMet', { post_id: request.id })
    expect(notices.map(a => String(a.get('reader_id'))).sort()).to.deep.equal([otherCommenter.id, follower.id].map(String).sort())
    const media = (await Notification.where({ activity_id: notices[0].id }).fetchAll()).pluck('medium')
    expect(media).to.deep.equal([Notification.MEDIUM.InApp])
  })

  it('adds helpers to a request that is already met, replacing their request met notice', async () => {
    await fulfillPost(author.id, request.id)
    expect((await activitiesWithReason('requestMet', { post_id: request.id, reader_id: otherCommenter.id })).length).to.equal(1)

    await fulfillPost(author.id, request.id, [otherCommenter.id])
    await runQueuedContributionJobs()
    expect(await activitiesWithReason('requestMet', { post_id: request.id, reader_id: otherCommenter.id })).to.have.length(0)
    expect(await activitiesWithReason('requestHelped', { post_id: request.id, reader_id: otherCommenter.id })).to.have.length(1)
    expect(await activitiesWithReason('requestMet', { post_id: request.id })).to.have.length(2)
  })

  it('only accepts people who commented, never the author', async () => {
    await expect(fulfillPost(author.id, request.id, [bystander.id])).to.be.rejectedWith(/commented/)
    await expect(fulfillPost(author.id, request.id, [author.id])).to.be.rejectedWith(/yourself/)
    await request.refresh()
    expect(request.get('fulfilled_at')).to.not.exist
  })

  it('lets only the author name helpers, and only on requests', async () => {
    const moderator = await factories.user().save()
    await assignAdministrator(moderator, group)
    await expect(fulfillPost(moderator.id, request.id, [helper.id])).to.be.rejectedWith(/Only the author/)

    const offer = await factories.post({ type: 'offer', user_id: author.id }).save()
    await offer.groups().attach(group)
    await factories.comment({ post_id: offer.id, user_id: helper.id }).save()
    await expect(fulfillPost(author.id, offer.id, [helper.id])).to.be.rejectedWith(/Only requests/)
  })

  it('reopening the request removes the helper and request met notices', async () => {
    await User.query().where({ id: helper.id }).update({ new_notification_count: 0 })
    await fulfillPost(author.id, request.id, [helper.id])
    await runQueuedContributionJobs()

    await unfulfillPost(author.id, request.id)
    expect(await activitiesWithReason('requestHelped', { post_id: request.id })).to.have.length(0)
    expect(await activitiesWithReason('requestMet', { post_id: request.id })).to.have.length(0)
    expect(await Contribution.where({ post_id: request.id }).fetchAll()).to.have.length(0)
  })
})
