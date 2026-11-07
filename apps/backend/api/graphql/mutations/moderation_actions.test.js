import '../../../test/setup'
import factories from '../../../test/setup/factories'
import { recordClickthrough, clearModerationAction, createModerationAction, reportToStaff, resolveStaffReport } from './moderation_actions'
import searchForModerationActions from '../../services/Search/forModerationActions'

describe('Moderation Action', () => {
  var user, post, g1, user2, agreements, modActions

  before(async function () {
    user = await factories.user().save()
    user2 = factories.user()
    post = factories.post({ type: 'discussion', user_id: user.id })
    g1 = factories.group({ active: true })
    return Promise.join(post.save(), g1.save(), user2.save())
      .then(() => factories.postUser({ post_id: post.id, user_id: user.id }).save())
      .then(() => user.joinGroup(g1))
      .then(() => user2.joinGroup(g1))
      .then(() => post.groups().attach(g1.id))
      .then(() => g1.update({ agreements: [{ title: 'Yay', description: 'I agree to be rad', order: 1 }] }, user.id))
      .then(async () => {
        agreements = await g1.agreements().fetch()
      })
  })

  it('rejects createModeractionAction if no agreements or platform agreements are specified', () => {
    return createModerationAction({ userId: user.id, data: { postId: post.id, text: 'Mean things were said', anonymous: false, agreements: [], platformAgreements: [], groupId: g1.id } })
      .then(() => expect.fail('should reject'))
      .catch(e => expect(e).to.match(/No agreements or platform agreements provided; you need to report against at least one of these/))
  })

  it('add a moderationAction on a post', () => {
    return createModerationAction({ userId: user.id, data: { postId: post.id, text: 'Mean things were said', groupId: g1.id, anonymous: false, agreements: [agreements.models[0].id], platformAgreements: [] } })
      .then(() => post.moderationActions().fetch())
      .then(async moderationActions => {
        modActions = moderationActions
        expect(moderationActions.length).to.equal(1)
        const resultPost = await Post.find(post.id)
        expect(resultPost.flaggedGroups()).to.include(g1.id)
      })
  })

  it('rejects if user is not authorized to clear a moderation action', () => {
    return clearModerationAction({ userId: user2.id, postId: post.id, groupId: g1.id, moderationActionId: modActions.models[0].id })
      .then(() => expect.fail('should reject'))
      .catch(e => {
        return expect(e.message).to.match(/You don't have permission to moderate this post/)
      })
  })

  it('Allows reporter to clear their moderationAction on a post', () => {
    return clearModerationAction({ userId: user.id, postId: post.id, groupId: g1.id, moderationActionId: modActions.models[0].id })
      .then(() => post.moderationActions().fetch())
      .then(moderationActions => {
        expect(moderationActions.models[0].get('status')).to.equal('cleared')
        expect(moderationActions.length).to.equal(1)
      })
  })

  it('allows users to clickthrough a moderated post', async () => {
    return recordClickthrough({ userId: user.id, postId: post.id })
      .then(async () => {
        const userPost = await PostUser.find(post.id, user.id)
        expect(userPost.get('clickthrough')).to.equal(true)
      })
  })

  describe('reporting a comment', () => {
    let commenter, comment, commentAction

    before(async () => {
      commenter = await factories.user().save()
      await commenter.joinGroup(g1)
      comment = await factories.comment({ post_id: post.id, user_id: commenter.id }).save()
    })

    it('files the report in the group queue against the comment, without flagging the post', async () => {
      const freshPost = await factories.post({ type: 'discussion', user_id: user.id }).save()
      await freshPost.groups().attach(g1.id)
      const freshComment = await factories.comment({ post_id: freshPost.id, user_id: commenter.id }).save()

      commentAction = await createModerationAction({
        userId: user2.id,
        data: { commentId: freshComment.id, text: 'Rude reply', groupId: g1.id, anonymous: false, agreements: [agreements.models[0].id], platformAgreements: [] }
      })

      expect(commentAction.get('comment_id')).to.equal(freshComment.id)
      expect(String(commentAction.get('post_id'))).to.equal(String(freshPost.id))
      expect(commentAction.get('queue')).to.equal('group')

      const reloaded = await Post.find(freshPost.id)
      expect(reloaded.flaggedGroups() || []).not.to.include(g1.id)

      const queue = await searchForModerationActions({ slug: g1.get('slug'), currentUserId: user.id }).fetchAll()
      expect(queue.pluck('id')).to.include(commentAction.id)

      // Comment reports are not reasons shown on the post itself
      const postActions = await freshPost.moderationActions().fetch()
      expect(postActions.length).to.equal(0)
    })

    it('rejects a comment that is not on the given post', () => {
      return createModerationAction({
        userId: user2.id,
        data: { commentId: comment.id, postId: -1, text: 'Rude reply', groupId: g1.id, anonymous: false, agreements: [agreements.models[0].id], platformAgreements: [] }
      })
        .then(() => expect.fail('should reject'))
        .catch(e => expect(e.message).to.match(/Comment not found/))
    })

    it('rejects a removed comment', async () => {
      const removed = await factories.comment({ post_id: post.id, user_id: commenter.id, active: false }).save()
      return createModerationAction({
        userId: user2.id,
        data: { commentId: removed.id, text: 'Rude reply', groupId: g1.id, anonymous: false, agreements: [agreements.models[0].id], platformAgreements: [] }
      })
        .then(() => expect.fail('should reject'))
        .catch(e => expect(e.message).to.match(/Comment not found/))
    })

    it('rejects a comment in a direct message conversation', async () => {
      const dm = await factories.post({ type: Post.Type.THREAD, user_id: commenter.id }).save()
      await dm.addFollowers([commenter.id, user2.id])
      const dmComment = await factories.comment({ post_id: dm.id, user_id: commenter.id }).save()
      return createModerationAction({
        userId: user2.id,
        data: { commentId: dmComment.id, text: 'Rude reply', groupId: g1.id, anonymous: false, agreements: [agreements.models[0].id], platformAgreements: [] }
      })
        .then(() => expect.fail('should reject'))
        .catch(e => expect(e.message).to.match(/Comment not found/))
    })

    it("rejects a group the comment's post is not in", async () => {
      const otherGroup = await factories.group({ active: true }).save()
      await user2.joinGroup(otherGroup)
      return createModerationAction({
        userId: user2.id,
        data: { commentId: comment.id, text: 'Rude reply', groupId: otherGroup.id, anonymous: false, agreements: [agreements.models[0].id], platformAgreements: [] }
      })
        .then(() => expect.fail('should reject'))
        .catch(e => expect(e.message).to.match(/not in that group/))
    })

    it('accepts the parent group of a space the post is in', async () => {
      const parent = await factories.group({ active: true }).save()
      const space = await factories.group({ active: true, parent_id: parent.id }).save()
      await user2.joinGroup(space)
      const spacePost = await factories.post({ type: 'discussion', user_id: commenter.id }).save()
      await spacePost.groups().attach(space.id)
      const spaceComment = await factories.comment({ post_id: spacePost.id, user_id: commenter.id }).save()

      const action = await createModerationAction({
        userId: user2.id,
        data: { commentId: spaceComment.id, text: 'Rude reply', groupId: parent.id, anonymous: false, agreements: [agreements.models[0].id], platformAgreements: [] }
      })
      expect(String(action.get('group_id'))).to.equal(String(parent.id))
    })

    it('clearing a comment report leaves the post flags alone', async () => {
      await clearModerationAction({ userId: user2.id, postId: commentAction.get('post_id'), groupId: g1.id, moderationActionId: commentAction.id })
      const cleared = await ModerationAction.where({ id: commentAction.id }).fetch()
      expect(cleared.get('status')).to.equal('cleared')
    })
  })

  describe('reporting to Hylo staff', () => {
    let reported, thread, oldAdmins, admin

    before(async () => {
      reported = await factories.user().save()
      admin = await factories.user().save()
      thread = await factories.post({ type: Post.Type.THREAD, user_id: user.id }).save()
      await thread.addFollowers([user.id, reported.id])
      oldAdmins = process.env.HYLO_ADMINS
      process.env.HYLO_ADMINS = String(admin.id)
    })

    after(() => {
      process.env.HYLO_ADMINS = oldAdmins
    })

    it('files a profile report in the staff queue only', async () => {
      await reportToStaff({ userId: user.id, data: { reportedUserId: reported.id, category: 'spam', text: 'Selling things' } })
      const report = await ModerationAction.where({ reporter_id: user.id, reported_user_id: reported.id, queue: 'staff' }).fetch()
      expect(report).not.to.equal(null)
      expect(report.get('group_id')).to.equal(null)
      expect(report.get('category')).to.equal('spam')

      const groupQueue = await searchForModerationActions({ slug: g1.get('slug'), currentUserId: user.id }).fetchAll()
      expect(groupQueue.pluck('id')).not.to.include(report.id)
      const unscoped = await searchForModerationActions({ currentUserId: user.id }).fetchAll()
      expect(unscoped.pluck('id')).not.to.include(report.id)

      const staffQueue = await searchForModerationActions({ queue: 'staff', status: 'active' }).fetchAll()
      expect(staffQueue.pluck('id')).to.include(report.id)
    })

    it('files a conversation report against the other person in a one-to-one thread', async () => {
      await reportToStaff({ userId: user.id, data: { messageThreadId: thread.id, category: 'abusive' } })
      const report = await ModerationAction.where({ reporter_id: user.id, message_thread_id: thread.id }).fetch()
      expect(report.get('queue')).to.equal('staff')
      expect(String(report.get('reported_user_id'))).to.equal(String(reported.id))
      const participants = await report.threadParticipants()
      expect(participants.pluck('id').map(String).sort()).to.deep.equal([user.id, reported.id].map(String).sort())
    })

    it('rejects a conversation the reporter is not in', () => {
      return reportToStaff({ userId: user2.id, data: { messageThreadId: thread.id, category: 'abusive' } })
        .then(() => expect.fail('should reject'))
        .catch(e => expect(e.message).to.match(/not a participant/))
    })

    it('rejects an unknown category, a missing explanation for other, and reporting yourself', async () => {
      await reportToStaff({ userId: user.id, data: { reportedUserId: reported.id, category: 'nope' } })
        .then(() => expect.fail('should reject'))
        .catch(e => expect(e.message).to.match(/Unknown category/))
      await reportToStaff({ userId: user.id, data: { reportedUserId: reported.id, category: 'other', text: ' ' } })
        .then(() => expect.fail('should reject'))
        .catch(e => expect(e.message).to.match(/explain/))
      await reportToStaff({ userId: user.id, data: { reportedUserId: user.id, category: 'spam' } })
        .then(() => expect.fail('should reject'))
        .catch(e => expect(e.message).to.match(/yourself/))
    })

    it('only super admins can resolve a staff report', async () => {
      const report = await ModerationAction.where({ reporter_id: user.id, reported_user_id: reported.id, queue: 'staff', category: 'spam' }).fetch()
      await resolveStaffReport({ userId: user.id, id: report.id })
        .then(() => expect.fail('should reject'))
        .catch(e => expect(e.message).to.match(/Unauthorized/))

      await resolveStaffReport({ userId: admin.id, id: report.id })
      await report.refresh()
      expect(report.get('status')).to.equal('resolved')
      expect(String(report.get('resolved_by_id'))).to.equal(String(admin.id))
      expect(!!report.get('resolved_at')).to.equal(true)
    })

    it('a staff report cannot be cleared through a group queue', async () => {
      const report = await ModerationAction.where({ reporter_id: user.id, message_thread_id: thread.id }).fetch()
      return clearModerationAction({ userId: user.id, postId: post.id, groupId: g1.id, moderationActionId: report.id })
        .then(() => expect.fail('should reject'))
        .catch(e => expect(e.message).to.match(/not found/))
    })
  })
})
