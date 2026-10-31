/* eslint-disable no-unused-expressions */
import setup from '../../../setup'
import factories from '../../../setup/factories'
import { assignAdministrator } from '../../../setup/roleHelpers'
import { mockify, unspyify } from '../../../setup/helpers'
import { convertChatSpaceToDiscussion, convertGroupToSpace, createSpace } from '../../../../api/graphql/mutations/spaces'
import { finishQueuedChatSpaceConversion } from '../../../../api/models/space/convertChatSpaceToDiscussion'

describe('convertChatSpaceToDiscussion', () => {
  let administrator, member, author, parentGroup

  before(async () => {
    administrator = await factories.user().save()
    member = await factories.user().save()
    author = await factories.user().save()
    parentGroup = await factories.group().save()
    await assignAdministrator(administrator, parentGroup)
    await member.joinGroup(parentGroup)
    await author.joinGroup(parentGroup)
  })

  after(async () => setup.clearDb())

  /**
   * A child group with one chat-only space, which is the shape that blocks convertGroupToSpace.
   */
  async function createChatRoom ({ parent = parentGroup, name = `Room ${Date.now()}` } = {}) {
    return createSpace(administrator.id, {
      parentGroupId: parent.id,
      name,
      acceptedPostTypes: ['chat']
    }, {})
  }

  /**
   * Save a chat message in the room at a fixed time.
   */
  async function chatMessage (space, user, { text, createdAt }) {
    const post = await factories.post({
      type: Post.Type.CHAT,
      user_id: user.id,
      description: text
    }).save()
    await bookshelf.knex('posts').where({ id: post.id }).update({
      created_at: createdAt,
      updated_at: createdAt
    })
    await post.groups().attach(space.id)
    return post
  }

  it('turns chat messages into comments and archives the room', async () => {
    process.env.CHAT_CONVERSION_BATCH_SIZE = '1'
    const child = await factories.group().save()
    await assignAdministrator(administrator, child)
    await parentGroup.addChild(child)
    const room = await createChatRoom({ parent: child, name: 'General' })

    const firstAt = new Date('2024-01-02T03:04:05.000Z')
    const secondAt = new Date('2024-06-07T08:09:10.000Z')
    const first = await chatMessage(room, author, { text: '<p>Hello</p>', createdAt: firstAt })
    const second = await chatMessage(room, administrator, { text: '<p>Later</p>', createdAt: secondAt })
    await factories.media({ post_id: first.id, type: 'image', url: 'https://example.com/chat.jpg' }).save()
    await new Reaction({
      entity_id: first.id,
      entity_type: 'post',
      user_id: author.id,
      emoji_full: '👍',
      emoji_base: '👍',
      emoji_label: 'thumbsup',
      date_reacted: new Date()
    }).save()
    const reply = await factories.comment({
      post_id: first.id,
      user_id: member.id,
      text: 'a reply'
    }).save()
    const nested = await factories.comment({
      post_id: first.id,
      comment_id: reply.id,
      user_id: author.id,
      text: 'nested'
    }).save()

    const preview = await convertChatSpaceToDiscussion(administrator.id, {
      spaceId: room.id,
      dryRun: true
    }, {})
    expect(preview.dryRun).to.equal(true)
    expect(preview.post).to.equal(null)
    expect(preview.messageCount).to.equal(2)
    expect(preview.authorCount).to.equal(2)
    expect(preview.attachmentCount).to.equal(1)
    expect(preview.reactionCount).to.equal(1)
    expect(preview.replyCount).to.equal(2)
    expect((await Post.find(first.id)).get('active')).to.equal(true)

    const result = await convertChatSpaceToDiscussion(administrator.id, {
      spaceId: room.id,
      title: 'General chat'
    }, {})

    expect(result.queued).to.equal(false)
    expect(result.post.get('type')).to.equal(Post.Type.DISCUSSION)
    expect(result.post.get('name')).to.equal('General chat')
    expect(result.post.get('user_id')).to.equal(administrator.id)
    expect(new Date(result.post.get('created_at')).getTime()).to.be.closeTo(Date.now(), 15000)
    expect(new Date(result.post.get('updated_at')).getTime()).to.be.closeTo(Date.now(), 15000)
    expect(result.post.get('num_comments')).to.equal(4)
    expect(String(result.post.get('description'))).to.match(/General/)

    const comments = await Comment.query(q => {
      q.where({ post_id: result.post.id })
      q.orderBy('created_at', 'asc')
      q.orderBy('id', 'asc')
    }).fetchAll()
    const topLevel = comments.models.filter(comment => !comment.get('comment_id'))
    expect(topLevel.map(comment => comment.get('text'))).to.deep.equal(['<p>Hello</p>', '<p>Later</p>'])
    expect(String(topLevel[0].get('user_id'))).to.equal(String(author.id))
    expect(topLevel[0].get('created_from')).to.equal('chat-conversion')
    expect(new Date(topLevel[0].get('created_at')).toISOString()).to.equal(firstAt.toISOString())

    const movedReply = await Comment.where({ id: reply.id }).fetch()
    const movedNested = await Comment.where({ id: nested.id }).fetch()
    expect(String(movedReply.get('post_id'))).to.equal(String(result.post.id))
    expect(String(movedReply.get('comment_id'))).to.equal(String(topLevel[0].id))
    expect(String(movedNested.get('post_id'))).to.equal(String(result.post.id))
    expect(String(movedNested.get('comment_id'))).to.equal(String(reply.id))

    const media = await Media.where({ url: 'https://example.com/chat.jpg' }).fetch()
    expect(media.get('post_id')).to.equal(null)
    expect(String(media.get('comment_id'))).to.equal(String(topLevel[0].id))

    const reaction = await Reaction.where({ user_id: author.id, emoji_full: '👍' }).fetch()
    expect(reaction.get('entity_type')).to.equal('comment')
    expect(String(reaction.get('entity_id'))).to.equal(String(topLevel[0].id))

    expect((await Post.find(first.id, { includeInactive: true }) || await Post.where({ id: first.id }).fetch()).get('active')).to.equal(false)
    expect((await Post.where({ id: second.id }).fetch()).get('active')).to.equal(false)

    const followers = await result.post.followers().fetch()
    const followerIds = followers.map(user => String(user.id))
    expect(followerIds).to.include(String(author.id))
    expect(followerIds).to.include(String(administrator.id))
    expect(followerIds).to.include(String(member.id))

    const activityCount = await bookshelf.knex('activities')
      .where({ post_id: result.post.id })
      .count('* as count')
      .first()
    expect(Number(activityCount.count)).to.equal(0)

    const archived = await Group.find(room.id)
    expect(archived.get('active')).to.equal(false)
    expect(archived.get('status')).to.equal(Group.Status.ARCHIVED)
    expect(String(archived.getSetting('chat_converted_to_post_id'))).to.equal(String(result.post.id))
    const menuEntry = await GroupView.where({
      type: GroupView.Type.SPACE,
      linked_group_id: room.id
    }).fetch()
    expect(menuEntry).to.equal(null)

    try {
      await convertChatSpaceToDiscussion(administrator.id, { spaceId: room.id }, {})
      expect.fail('should throw')
    } catch (e) {
      expect(e.message).to.match(/already been converted/)
    }

    const converted = await convertGroupToSpace(administrator.id, {
      id: child.id,
      parentGroupId: parentGroup.id
    }, {})
    expect(converted.get('type')).to.equal('space')
    expect(String(converted.get('parent_id'))).to.equal(String(parentGroup.id))

    delete process.env.CHAT_CONVERSION_BATCH_SIZE
  })

  it('rejects people who do not administer the parent', async () => {
    const room = await createChatRoom()
    try {
      await convertChatSpaceToDiscussion(member.id, { spaceId: room.id }, {})
      expect.fail('should throw')
    } catch (e) {
      expect(e.message).to.match(/permission/)
    }
  })

  it('rejects a space that is not a chat room', async () => {
    const room = await createSpace(administrator.id, {
      parentGroupId: parentGroup.id,
      name: `Not chat ${Date.now()}`,
      acceptedPostTypes: ['discussion']
    }, {})
    try {
      await convertChatSpaceToDiscussion(administrator.id, { spaceId: room.id }, {})
      expect.fail('should throw')
    } catch (e) {
      expect(e.message).to.match(/Only a chat room/)
    }
  })

  it('leaves posts that are not chat messages in place', async () => {
    const room = await createChatRoom({ name: `Mixed ${Date.now()}` })
    const other = await factories.post({ type: Post.Type.DISCUSSION, user_id: author.id }).save()
    await other.groups().attach(room.id)
    await chatMessage(room, author, {
      text: '<p>Only this one</p>',
      createdAt: new Date('2024-05-01T00:00:00.000Z')
    })

    const result = await convertChatSpaceToDiscussion(administrator.id, { spaceId: room.id, title: 'Mixed room' }, {})
    expect(result.post.get('num_comments')).to.equal(1)
    const kept = await Post.find(other.id)
    expect(kept.get('active')).to.equal(true)
    expect(kept.get('type')).to.equal(Post.Type.DISCUSSION)
    const stillLinked = await bookshelf.knex('groups_posts').where({ post_id: other.id, group_id: room.id }).first()
    expect(stillLinked).to.not.equal(undefined)
  })

  it('rejects messages that also belong to another group', async () => {
    const room = await createChatRoom({ name: `Shared ${Date.now()}` })
    const message = await chatMessage(room, author, {
      text: '<p>Shared</p>',
      createdAt: new Date('2024-02-02T00:00:00.000Z')
    })
    await message.groups().attach(parentGroup.id)
    try {
      await convertChatSpaceToDiscussion(administrator.id, { spaceId: room.id }, {})
      expect.fail('should throw')
    } catch (e) {
      expect(e.message).to.match(/another group/)
    }
    expect((await Post.find(message.id)).get('active')).to.equal(true)
  })

  it('rejects when the parent does not accept discussions', async () => {
    const child = await factories.group({ accepted_post_types: ['event'] }).save()
    await assignAdministrator(administrator, child)
    const room = await createChatRoom({ parent: child, name: `Events only ${Date.now()}` })
    try {
      await convertChatSpaceToDiscussion(administrator.id, { spaceId: room.id }, {})
      expect.fail('should throw')
    } catch (e) {
      expect(e.message).to.match(/does not accept discussion/)
    }
  })

  it('rejects a chat room whose parent is a space', async () => {
    const mid = await createSpace(administrator.id, {
      parentGroupId: parentGroup.id,
      name: `Mid ${Date.now()}`
    }, {})
    const room = await createChatRoom({ parent: mid, name: `Nested ${Date.now()}` })
    try {
      await convertChatSpaceToDiscussion(administrator.id, { spaceId: room.id }, {})
      expect.fail('should throw')
    } catch (e) {
      expect(e.message).to.match(/parent is itself a space/)
    }
  })

  it('queues a large room and the worker finishes it', async () => {
    process.env.CHAT_CONVERSION_QUEUE_THRESHOLD = '1'
    const room = await createChatRoom({ name: `Large ${Date.now()}` })
    const firstAt = new Date('2024-04-01T00:00:00.000Z')
    const secondAt = new Date('2024-04-02T00:00:00.000Z')
    await chatMessage(room, author, { text: '<p>One</p>', createdAt: firstAt })
    await chatMessage(room, author, { text: '<p>Two</p>', createdAt: secondAt })

    mockify(Queue, 'classMethod', () => Promise.resolve())
    let result
    try {
      result = await convertChatSpaceToDiscussion(administrator.id, { spaceId: room.id, title: 'Backlog' }, {})
      expect(result.queued).to.equal(true)
      expect(result.post.get('name')).to.equal('Backlog')
      expect(result.post.get('num_comments')).to.equal(0)
      expect(Queue.classMethod).to.have.been.called
    } finally {
      unspyify(Queue, 'classMethod')
      delete process.env.CHAT_CONVERSION_QUEUE_THRESHOLD
    }

    const pending = await Group.find(room.id)
    expect(pending.get('status')).to.not.equal(Group.Status.ARCHIVED)
    expect(pending.getSetting('chat_conversion_status')).to.equal('pending')

    await finishQueuedChatSpaceConversion({
      spaceId: room.id,
      postId: result.post.id,
      userId: administrator.id
    })

    const done = await Group.find(room.id)
    expect(done.get('active')).to.equal(false)
    expect(done.get('status')).to.equal(Group.Status.ARCHIVED)
    const discussion = await Post.find(result.post.id)
    expect(discussion.get('num_comments')).to.equal(2)

    await finishQueuedChatSpaceConversion({
      spaceId: room.id,
      postId: result.post.id,
      userId: administrator.id
    })
    const again = await Post.find(result.post.id)
    expect(again.get('num_comments')).to.equal(2)
  })

  it('names the spaces that block convertGroupToSpace', async () => {
    const child = await factories.group().save()
    await assignAdministrator(administrator, child)
    await parentGroup.addChild(child)
    const room = await createChatRoom({ parent: child, name: 'Blocked room' })

    try {
      await convertGroupToSpace(administrator.id, {
        id: child.id,
        parentGroupId: parentGroup.id
      }, {})
      expect.fail('should throw')
    } catch (e) {
      expect(e.message).to.match(/has spaces/)
      expect(e.message).to.match(/Blocked room/)
      expect(e.extensions.blockingSpaces[0].chatOnly).to.equal(true)
      expect(String(e.extensions.blockingSpaces[0].id)).to.equal(String(room.id))
    }
  })
})
