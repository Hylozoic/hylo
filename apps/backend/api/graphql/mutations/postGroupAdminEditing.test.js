/* eslint-disable no-unused-expressions */
import setup from '../../../test/setup'
import factories from '../../../test/setup/factories'
import { createPost, updatePost, updateProposalOutcome } from './post'
import { spyify, unspyify } from '../../../test/setup/helpers'

// #1727: a post's creator can let the content managers of its single group edit it
describe('group admin editing of posts', () => {
  let author, moderator, member, group, otherGroup, space

  async function makeModerator (user, inGroup) {
    const role = await GroupRole.findSystemRole(inGroup.id, 'Moderator')
    await MemberGroupRole.forge({ user_id: user.id, group_id: inGroup.id, group_role_id: role.id, active: true }).save()
  }

  function editData (post, overrides = {}) {
    return {
      title: post.get('name'),
      details: '<p>Edited</p>',
      type: post.get('type'),
      groupIds: [group.id],
      ...overrides
    }
  }

  before(async () => {
    await setup.clearDb()
    author = await factories.user().save()
    moderator = await factories.user().save()
    member = await factories.user().save()
    group = await factories.group().save()
    otherGroup = await factories.group().save()
    space = await factories.group({ type: 'space', parent_id: group.id }).save()
    await GroupRole.setupSystemRoles(group.id)
    for (const user of [author, moderator, member]) {
      await user.joinGroup(group)
    }
    await author.joinGroup(otherGroup)
    await author.joinGroup(space)
    await makeModerator(author, group)
    await makeModerator(moderator, group)
  })

  beforeEach(() => {
    spyify(Queue, 'classMethod', () => Promise.resolve())
  })

  afterEach(() => {
    unspyify(Queue, 'classMethod')
  })

  async function makePost (attrs = {}, groups = [group]) {
    const post = await factories.post({ type: 'discussion', user_id: author.id, ...attrs }).save()
    await post.groups().attach(groups.map(g => g.id))
    return post
  }

  describe('createPost', () => {
    it('saves the setting for a content manager posting to one group and its spaces', async () => {
      const post = await createPost(author.id, {
        title: 'Shared', details: '<p>x</p>', type: 'discussion', groupIds: [group.id, space.id], groupAdminsCanEdit: true
      })
      expect((await Post.find(post.id)).get('group_admins_can_edit')).to.be.true
    })

    it('rejects the setting for a post going to more than one group', async () => {
      await expect(createPost(author.id, {
        title: 'Shared', details: '<p>x</p>', type: 'discussion', groupIds: [group.id, otherGroup.id], groupAdminsCanEdit: true
      })).to.be.rejectedWith(/single group/)
    })

    it('rejects the setting from a member without Manage Content', async () => {
      await expect(createPost(member.id, {
        title: 'Shared', details: '<p>x</p>', type: 'discussion', groupIds: [group.id], groupAdminsCanEdit: true
      })).to.be.rejectedWith(/manage content/)
    })
  })

  describe('updatePost', () => {
    it('rejects edits by anyone else when the setting is off', async () => {
      const post = await makePost()
      await expect(updatePost(moderator.id, { id: post.id, data: editData(post) })).to.be.rejectedWith(/permission/)
      await expect(updatePost(member.id, { id: post.id, data: editData(post) })).to.be.rejectedWith(/permission/)
    })

    it('lets a content manager edit when allowed, keeping the creator, groups and setting', async () => {
      const post = await makePost({ group_admins_can_edit: true }, [group, space])
      await updatePost(moderator.id, {
        id: post.id,
        // tries to move the post to only the parent group and turn the setting off
        data: editData(post, { details: '<p>Edited by moderator</p>', groupIds: [group.id], groupAdminsCanEdit: false })
      })
      const saved = await Post.where({ id: post.id }).fetch({ withRelated: 'groups' })
      expect(saved.get('description')).to.equal('<p>Edited by moderator</p>')
      expect(String(saved.get('user_id'))).to.equal(String(author.id))
      expect(saved.get('group_admins_can_edit')).to.be.true
      expect(saved.relations.groups.pluck('id').map(String).sort()).to.deep.equal([group.id, space.id].map(String).sort())
    })

    it('still rejects regular members when allowed', async () => {
      const post = await makePost({ group_admins_can_edit: true })
      await expect(updatePost(member.id, { id: post.id, data: editData(post) })).to.be.rejectedWith(/permission/)
    })

    it('rejects other admins once the post is shared to a second group', async () => {
      const post = await makePost({ group_admins_can_edit: true })
      await updatePost(author.id, { id: post.id, data: editData(post, { groupIds: [group.id, otherGroup.id] }) })
      const saved = await Post.find(post.id)
      expect(saved.get('group_admins_can_edit')).to.be.true
      await expect(updatePost(moderator.id, { id: post.id, data: editData(post, { groupIds: [group.id, otherGroup.id] }) })).to.be.rejectedWith(/permission/)
    })

    it('lets the creator turn the setting on and off', async () => {
      const post = await makePost()
      await updatePost(author.id, { id: post.id, data: editData(post, { groupAdminsCanEdit: true }) })
      expect((await Post.find(post.id)).get('group_admins_can_edit')).to.be.true
      await updatePost(author.id, { id: post.id, data: editData(post, { groupAdminsCanEdit: false }) })
      expect((await Post.find(post.id)).get('group_admins_can_edit')).to.be.false
    })

    it('keeps the setting when an update leaves it out', async () => {
      const post = await makePost({ group_admins_can_edit: true })
      await updatePost(author.id, { id: post.id, data: editData(post) })
      expect((await Post.find(post.id)).get('group_admins_can_edit')).to.be.true
    })

    it('rejects turning the setting on while the post is in more than one group', async () => {
      const post = await makePost({}, [group, otherGroup])
      await expect(updatePost(author.id, {
        id: post.id, data: editData(post, { groupIds: [group.id, otherGroup.id], groupAdminsCanEdit: true })
      })).to.be.rejectedWith(/single group/)
    })
  })

  describe('updateProposalOutcome', () => {
    it('lets a content manager update the outcome when allowed', async () => {
      const post = await makePost({ type: 'proposal', group_admins_can_edit: true })
      expect(await updateProposalOutcome({ userId: moderator.id, postId: post.id, proposalOutcome: 'successful' })).to.deep.equal({ success: true })
    })

    it('rejects a content manager when not allowed', async () => {
      const post = await makePost({ type: 'proposal' })
      await expect(updateProposalOutcome({ userId: moderator.id, postId: post.id, proposalOutcome: 'successful' })).to.be.rejectedWith(/permission/)
    })
  })
})
