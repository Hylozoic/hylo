/* eslint-disable no-unused-expressions */
import setup from '../../../test/setup'
import factories from '../../../test/setup/factories'
import { updatePost, updateProposalOutcome, setProposalOptions, updateProposalOptions } from './post'
import underlyingUpdatePost from '../../models/post/updatePost'
import { canEditPost } from '../../models/post/postEditPermissions'
import { spyify, unspyify } from '../../../test/setup/helpers'

describe('who can update a post', () => {
  let author, admin, moderator, member, group, space

  async function giveRole (user, inGroup, roleName) {
    const role = await GroupRole.findSystemRole(inGroup.id, roleName)
    await MemberGroupRole.forge({ user_id: user.id, group_id: inGroup.id, group_role_id: role.id, active: true }).save()
  }

  async function makePost (attrs = {}, groups = [group]) {
    const post = await factories.post({ type: 'discussion', user_id: author.id, ...attrs }).save()
    await post.groups().attach(groups.map(g => g.id))
    return post
  }

  function editData (post, groups = [group], overrides = {}) {
    return { title: post.get('name'), details: '<p>Edited</p>', type: post.get('type'), groupIds: groups.map(g => g.id), ...overrides }
  }

  before(async () => {
    await setup.clearDb()
    author = await factories.user().save()
    admin = await factories.user().save()
    moderator = await factories.user().save()
    member = await factories.user().save()
    group = await factories.group().save()
    space = await factories.group({ type: 'space', parent_id: group.id }).save()
    await GroupRole.setupSystemRoles(group.id)
    for (const user of [author, admin, moderator, member]) {
      await user.joinGroup(group)
      await user.joinGroup(space)
    }
    await giveRole(admin, group, 'Administrator')
    await giveRole(moderator, group, 'Moderator')
  })

  beforeEach(() => {
    spyify(Queue, 'classMethod', () => Promise.resolve())
  })

  afterEach(() => {
    unspyify(Queue, 'classMethod')
  })

  describe('canEditPost', () => {
    it('allows the creator', async () => {
      expect(await canEditPost(author.id, await makePost())).to.be.true
    })

    it('does not allow other members, moderators or administrators on regular posts', async () => {
      const post = await makePost()
      expect(await canEditPost(member.id, post)).to.be.false
      expect(await canEditPost(moderator.id, post)).to.be.false
      expect(await canEditPost(admin.id, post)).to.be.false
      expect(await canEditPost(null, post)).to.be.false
    })

    it('allows administrators of the space (via its parent group) to edit track actions', async () => {
      const action = await makePost({ type: 'action' }, [space])
      expect(await canEditPost(admin.id, action)).to.be.true
      expect(await canEditPost(moderator.id, action)).to.be.false
      expect(await canEditPost(member.id, action)).to.be.false
    })
  })

  describe('updatePost mutation', () => {
    it('lets the creator update their post', async () => {
      const post = await makePost()
      await updatePost(author.id, { id: post.id, data: editData(post, [group], { details: '<p>By the author</p>' }) })
      expect((await Post.find(post.id)).get('description')).to.equal('<p>By the author</p>')
    })

    it('rejects anyone else, leaving the post unchanged', async () => {
      const post = await makePost({ description: '<p>Original</p>' })
      for (const user of [member, moderator, admin]) {
        await expect(updatePost(user.id, { id: post.id, data: editData(post) })).to.be.rejectedWith(/permission/)
      }
      await expect(updatePost(null, { id: post.id, data: editData(post) })).to.be.rejectedWith(/permission/)
      expect((await Post.find(post.id)).get('description')).to.equal('<p>Original</p>')
    })

    it('rejects an unknown post', async () => {
      await expect(updatePost(author.id, { id: '99999999', data: editData({ get: () => 'x' }) })).to.be.rejectedWith(/Post not found/)
    })

    it('lets a track steward update an action someone else created, and keeps the original author', async () => {
      const action = await makePost({ type: 'action' }, [space])
      await updatePost(admin.id, { id: action.id, data: editData(action, [space], { details: '<p>By a steward</p>' }) })
      const saved = await Post.find(action.id)
      expect(saved.get('description')).to.equal('<p>By a steward</p>')
      expect(String(saved.get('user_id'))).to.equal(String(author.id))
    })
  })

  describe('underlying updatePost', () => {
    it('rejects anyone else', async () => {
      const post = await makePost()
      await expect(underlyingUpdatePost(member.id, post.id, { name: 'Changed', description: '<p>x</p>' })).to.be.rejectedWith(/permission/)
    })

    it('keeps the original author when the creator updates', async () => {
      const post = await makePost()
      await underlyingUpdatePost(author.id, post.id, { name: 'Changed', description: '<p>x</p>', group_ids: [group.id] })
      expect(String((await Post.find(post.id)).get('user_id'))).to.equal(String(author.id))
    })
  })

  describe('proposal mutations', () => {
    async function makeProposal (status = Post.Proposal_Status.DISCUSSION) {
      return makePost({ type: 'proposal', proposal_status: status })
    }

    it('updateProposalOutcome allows the creator only', async () => {
      const post = await makeProposal(Post.Proposal_Status.COMPLETED)
      expect(await updateProposalOutcome({ userId: author.id, postId: post.id, proposalOutcome: 'done' })).to.deep.equal({ success: true })
      await expect(updateProposalOutcome({ userId: member.id, postId: post.id, proposalOutcome: 'nope' })).to.be.rejectedWith(/permission/)
    })

    it('setProposalOptions allows the creator only', async () => {
      const post = await makeProposal()
      expect(await setProposalOptions({ userId: author.id, postId: post.id, options: [{ text: 'A' }] })).to.deep.equal({ success: true })
      await expect(setProposalOptions({ userId: member.id, postId: post.id, options: [{ text: 'B' }] })).to.be.rejectedWith(/permission/)
      const options = await post.proposalOptions().fetch()
      expect(options.pluck('text')).to.deep.equal(['A'])
    })

    it('updateProposalOptions allows the creator only', async () => {
      const post = await makeProposal()
      expect(await updateProposalOptions({ userId: author.id, postId: post.id, options: [{ text: 'A' }] })).to.deep.equal({ success: true })
      await expect(updateProposalOptions({ userId: member.id, postId: post.id, options: [{ text: 'B' }] })).to.be.rejectedWith(/permission/)
    })
  })
})
