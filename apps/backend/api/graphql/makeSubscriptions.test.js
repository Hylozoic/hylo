import '../../test/setup'
import factories from '../../test/setup/factories'
import makeSubscriptions from './makeSubscriptions'
import { graphiqlEnabled } from './index'

describe('makeSubscriptions', () => {
  let member, outsider, participant, groupPost, comment, thread
  const { comments, peopleTyping } = makeSubscriptions()

  const makeContext = userId => ({
    currentUserId: userId,
    pubSub: { subscribe: spy(() => (async function * () {})()) },
    request: { headers: { get: () => null } }
  })

  before(async () => {
    member = await factories.user().save()
    outsider = await factories.user().save()
    participant = await factories.user().save()
    const group = await factories.group().save()
    await member.joinGroup(group)

    groupPost = await factories.post({ user_id: member.id }).save()
    await group.posts().attach(groupPost)
    comment = await factories.comment({ post_id: groupPost.id, user_id: member.id }).save()

    thread = await factories.post({ type: Post.Type.THREAD, user_id: participant.id }).save()
    await thread.addFollowers([participant.id])
  })

  describe('comments', () => {
    it('subscribes a group member to comments on a post', async () => {
      const context = makeContext(member.id)
      await comments.subscribe(null, { postId: groupPost.id }, context)
      expect(context.pubSub.subscribe).to.have.been.called.with(`comments:postId:${groupPost.id}`)
    })

    it('subscribes a group member to replies on a comment', async () => {
      const context = makeContext(member.id)
      await comments.subscribe(null, { parentCommentId: comment.id }, context)
      expect(context.pubSub.subscribe).to.have.been.called.with(`comments:commentId:${comment.id}`)
    })

    it('refuses someone who cannot see the post', async () => {
      const context = makeContext(outsider.id)
      await expect(comments.subscribe(null, { postId: groupPost.id }, context)).to.be.rejectedWith('You do not have permission to do that')
      await expect(comments.subscribe(null, { parentCommentId: comment.id }, context)).to.be.rejectedWith('You do not have permission to do that')
      expect(context.pubSub.subscribe).not.to.have.been.called()
    })

    it('refuses anonymous requests and unknown posts', async () => {
      await expect(comments.subscribe(null, { postId: groupPost.id }, makeContext(undefined))).to.be.rejectedWith('You do not have permission to do that')
      await expect(comments.subscribe(null, { postId: '999999999' }, makeContext(member.id))).to.be.rejectedWith('You do not have permission to do that')
    })
  })

  describe('peopleTyping', () => {
    it('subscribes a thread participant', async () => {
      const context = makeContext(participant.id)
      await peopleTyping.subscribe(null, { messageThreadId: thread.id }, context)
      expect(context.pubSub.subscribe).to.have.been.called.with(`peopleTyping:messageThreadId:${thread.id}`)
    })

    it('refuses someone outside the thread', async () => {
      const context = makeContext(outsider.id)
      await expect(peopleTyping.subscribe(null, { messageThreadId: thread.id }, context)).to.be.rejectedWith('You do not have permission to do that')
      expect(context.pubSub.subscribe).not.to.have.been.called()
    })

    it('checks the post of a comment', async () => {
      await peopleTyping.subscribe(null, { commentId: comment.id }, makeContext(member.id))
      await expect(peopleTyping.subscribe(null, { commentId: comment.id }, makeContext(outsider.id))).to.be.rejectedWith('You do not have permission to do that')
    })
  })
})

describe('graphiqlEnabled', () => {
  let nodeEnv, admins

  before(() => {
    nodeEnv = process.env.NODE_ENV
    admins = process.env.HYLO_ADMINS
    process.env.HYLO_ADMINS = '42'
  })

  after(() => {
    process.env.NODE_ENV = nodeEnv
    process.env.HYLO_ADMINS = admins
  })

  it('is on outside production', () => {
    process.env.NODE_ENV = 'test'
    expect(graphiqlEnabled(null, { req: { session: {} } })).to.equal(true)
  })

  it('is only on for Hylo admins in production', () => {
    process.env.NODE_ENV = 'production'
    expect(graphiqlEnabled(null, { req: { session: {} } })).to.equal(false)
    expect(graphiqlEnabled(null, { req: { session: { userId: 7 } } })).to.equal(false)
    expect(graphiqlEnabled(null, {})).to.equal(false)
    expect(graphiqlEnabled(null, { req: { session: { userId: 42 } } })).to.equal(true)
  })
})
