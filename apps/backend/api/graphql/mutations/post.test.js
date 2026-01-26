import '../../../test/setup'
import setup from '../../../test/setup'
import factories from '../../../test/setup/factories'
import { pinPost, removeProposalVote, addProposalVote, swapProposalVote, setProposalOptions, updateProposalOptions, deletePost } from './post'
import { spyify, unspyify } from '../../../test/setup/helpers'

describe('pinPost', () => {
  var user, group, post

  before(function () {
    user = factories.user()
    group = factories.group()
    post = factories.post()
    return Promise.join(group.save(), user.save(), post.save())
      .then(() => group.posts().attach(post))
      .then(() => user.joinGroup(group, { role: GroupMembership.Role.MODERATOR }))
  })

  it('sets pinned_at to current time if not set', () => {
    return pinPost(user.id, post.id, group.id)
    .then(() => PostMembership.find(post.id, group.id))
    .then(postMembership => {
      expect(postMembership.get('pinned_at').getTime())
      .to.be.closeTo(new Date().getTime(), 2000)
    })
  })

  it('sets pinned_at to null if set', () => {
    return pinPost(user.id, post.id, group.id)
    .then(() => PostMembership.find(post.id, group.id))
    .then(postMembership => {
      expect(postMembership.get('pinned_at')).to.equal(null)
    })
  })

  it('rejects if user is not a moderator', () => {
    return pinPost('777', post.id, group.id)
    .then(() => expect.fail('should reject'))
    .catch(e => expect(e.message).to.match(/don't have permission/))
  })

  it("rejects if postMembership doesn't exist", () => {
    return pinPost(user.id, '919191', group.id)
    .then(() => expect.fail('should reject'))
    .catch(e => expect(e.message).to.match(/Couldn't find postMembership/))
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
