/* eslint-disable no-unused-expressions */
import setup from '../../../test/setup'
import factories from '../../../test/setup/factories'
import { mockify, unspyify } from '../../../test/setup/helpers'
import { saveDraft, deleteDraftForContext } from './draft'
import { createComment, createMessage } from './comment'
import { createPost } from './post'

const context = { pubSub: { publish: () => {} } }

// Simulates the race in #1704: the draft row is deleted by someone else after
// findForContext has found it, so the model we destroy no longer has a row.
// Records the stale drafts it hands out so tests can check the race really happened.
function deleteRowAfterFind (staleDrafts = []) {
  const original = Draft.findForContext
  return async (...args) => {
    const draft = await original.apply(Draft, args)
    if (draft) {
      await bookshelf.knex('drafts').where({ id: draft.id }).del()
      staleDrafts.push(draft)
    }
    return draft
  }
}

const draftExists = async id => !!(await Draft.where({ id }).fetch({ require: false }))

describe('draft cleanup', () => {
  let u1, u2, group, post, thread

  before(async () => {
    await setup.clearDb()
    u1 = await factories.user().save()
    u2 = await factories.user().save()
    group = await factories.group().save()
    await u1.joinGroup(group)
    post = await factories.post({ user_id: u2.id, active: true }).save()
    await post.groups().attach(group)
    thread = await factories.post({ user_id: u1.id, active: true, type: Post.Type.THREAD }).save()
    await thread.addFollowers([u1.id, u2.id])
  })

  afterEach(() => {
    unspyify(Draft, 'findForContext')
  })

  describe('deleteDraftForContext', () => {
    it('deletes the draft for the context', async () => {
      const draft = await saveDraft(u1.id, { type: 'message', data: '<p>hi</p>', messageThreadId: thread.id })
      await deleteDraftForContext(u1.id, { type: 'message', messageThreadId: thread.id })
      expect(await draftExists(draft.id)).to.be.false
    })

    it('succeeds when the draft row is deleted between find and destroy', async () => {
      await saveDraft(u1.id, { type: 'message', data: '<p>hi</p>', messageThreadId: thread.id })
      const stale = []
      mockify(Draft, 'findForContext', deleteRowAfterFind(stale))
      const result = await deleteDraftForContext(u1.id, { type: 'message', messageThreadId: thread.id })
      expect(result).to.deep.equal({ success: true })
      expect(stale).to.have.length(1)
    })
  })

  describe('createMessage', () => {
    it('removes the message draft', async () => {
      const draft = await saveDraft(u1.id, { type: 'message', data: '<p>hi</p>', messageThreadId: thread.id })
      const comment = await createMessage(u1.id, { messageThreadId: thread.id, text: 'hello' }, context)
      expect(comment.id).to.exist
      expect(await draftExists(draft.id)).to.be.false
    })

    it('returns the message when the draft is deleted between find and destroy', async () => {
      await saveDraft(u1.id, { type: 'message', data: '<p>hi</p>', messageThreadId: thread.id })
      const stale = []
      mockify(Draft, 'findForContext', deleteRowAfterFind(stale))
      const comment = await createMessage(u1.id, { messageThreadId: thread.id, text: 'race' }, context)
      expect(stale).to.have.length(1)
      expect(comment.id).to.exist
      expect(comment.get('text')).to.match(/race/)
    })

    it('returns the message when draft cleanup fails', async () => {
      mockify(Draft, 'findForContext', () => Promise.reject(new Error('cleanup failed')))
      const comment = await createMessage(u1.id, { messageThreadId: thread.id, text: 'still sent' }, context)
      expect(comment.id).to.exist
      expect(Draft.findForContext).to.have.been.called()
    })
  })

  describe('createComment', () => {
    it('returns the comment when draft cleanup fails', async () => {
      mockify(Draft, 'findForContext', () => Promise.reject(new Error('cleanup failed')))
      const comment = await createComment(u1.id, { postId: post.id, text: 'a comment' }, context)
      expect(comment.id).to.exist
      expect(Draft.findForContext).to.have.been.called()
    })

    it('returns the comment when the draft is deleted between find and destroy', async () => {
      await saveDraft(u1.id, { type: 'comment', data: '<p>hi</p>', postId: post.id })
      const stale = []
      mockify(Draft, 'findForContext', deleteRowAfterFind(stale))
      const comment = await createComment(u1.id, { postId: post.id, text: 'race' }, context)
      expect(stale).to.have.length(1)
      expect(comment.id).to.exist
    })
  })

  describe('createPost', () => {
    const postData = () => ({
      title: 'A discussion',
      details: '<p>Details</p>',
      type: Post.Type.DISCUSSION,
      groupIds: [group.id]
    })

    it('removes the new post draft', async () => {
      const draft = await saveDraft(u1.id, {
        type: 'post',
        data: JSON.stringify({ title: 'draft title' }),
        groupId: group.id,
        postType: Post.Type.DISCUSSION
      })
      const created = await createPost(u1.id, postData())
      expect(created.id).to.exist
      expect(await draftExists(draft.id)).to.be.false
    })

    it('returns the post when draft cleanup fails', async () => {
      mockify(Draft, 'findForContext', () => Promise.reject(new Error('cleanup failed')))
      const created = await createPost(u1.id, postData())
      expect(created.id).to.exist
      expect(Draft.findForContext).to.have.been.called()
    })
  })
})
