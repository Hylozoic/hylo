/* eslint-disable no-unused-expressions */
import setup from '../../../test/setup'
import factories from '../../../test/setup/factories'
import {
  canEditPost,
  singleRootGroupIdForGroupIds,
  assertCanAllowGroupAdminEdits
} from './postEditPermissions'

describe('postEditPermissions', () => {
  let author, contentManager, admin, member, outsider, group, otherGroup, space, otherSpace

  async function giveRole (user, inGroup, roleName) {
    const role = await GroupRole.findSystemRole(inGroup.id, roleName)
    await MemberGroupRole.forge({
      user_id: user.id,
      group_id: inGroup.id,
      group_role_id: role.id,
      active: true
    }).save()
  }

  async function makePost (attrs, groups) {
    const post = await factories.post({ type: 'discussion', user_id: author.id, ...attrs }).save()
    await post.groups().attach(groups.map(g => g.id))
    return post
  }

  before(async () => {
    await setup.clearDb()
    author = await factories.user().save()
    contentManager = await factories.user().save()
    admin = await factories.user().save()
    member = await factories.user().save()
    outsider = await factories.user().save()
    group = await factories.group().save()
    otherGroup = await factories.group().save()
    space = await factories.group({ type: 'space', parent_id: group.id }).save()
    otherSpace = await factories.group({ type: 'space', parent_id: group.id }).save()
    await GroupRole.setupSystemRoles(group.id)
    await GroupRole.setupSystemRoles(otherGroup.id)
    for (const user of [author, contentManager, admin, member]) {
      await user.joinGroup(group)
    }
    await contentManager.joinGroup(otherGroup)
    // Moderators have Manage Content (but not Administration)
    await giveRole(contentManager, group, 'Moderator')
    await giveRole(contentManager, otherGroup, 'Moderator')
    await giveRole(admin, group, 'Administrator')
  })

  describe('canEditPost', () => {
    it('lets the creator edit', async () => {
      const post = await makePost({}, [group, otherGroup])
      expect(await canEditPost(author.id, post)).to.be.true
    })

    it('does not let a content manager edit when the creator has not allowed it', async () => {
      const post = await makePost({}, [group])
      expect(await canEditPost(contentManager.id, post)).to.be.false
    })

    it('lets content managers and administrators edit when allowed and the post is in one group', async () => {
      const post = await makePost({ group_admins_can_edit: true }, [group])
      expect(await canEditPost(contentManager.id, post)).to.be.true
      expect(await canEditPost(admin.id, post)).to.be.true
    })

    it('treats several spaces of the same group as one group', async () => {
      const post = await makePost({ group_admins_can_edit: true }, [space, otherSpace, group])
      expect(await canEditPost(contentManager.id, post)).to.be.true
      const spaceOnlyPost = await makePost({ group_admins_can_edit: true }, [space])
      expect(await canEditPost(contentManager.id, spaceOnlyPost)).to.be.true
    })

    it('does not let regular members or outsiders edit', async () => {
      const post = await makePost({ group_admins_can_edit: true }, [group])
      expect(await canEditPost(member.id, post)).to.be.false
      expect(await canEditPost(outsider.id, post)).to.be.false
      expect(await canEditPost(null, post)).to.be.false
    })

    it('does not let group admins edit while the post is in more than one group', async () => {
      const post = await makePost({ group_admins_can_edit: true }, [group, otherGroup])
      // contentManager manages content in BOTH groups, and still can't edit
      expect(await canEditPost(contentManager.id, post)).to.be.false
      expect(await canEditPost(author.id, post)).to.be.true
    })

    it('does not apply to chat posts', async () => {
      const post = await makePost({ type: 'chat', group_admins_can_edit: true }, [group])
      expect(await canEditPost(contentManager.id, post)).to.be.false
    })

    it('lets administrators edit track actions they did not create', async () => {
      const action = await makePost({ type: 'action' }, [space])
      expect(await canEditPost(admin.id, action)).to.be.true
      expect(await canEditPost(contentManager.id, action)).to.be.false
      expect(await canEditPost(member.id, action)).to.be.false
    })
  })

  describe('singleRootGroupIdForGroupIds', () => {
    it('returns the parent group for spaces of one group', async () => {
      expect(await singleRootGroupIdForGroupIds([space.id, otherSpace.id])).to.equal(String(group.id))
      expect(await singleRootGroupIdForGroupIds([group.id, space.id])).to.equal(String(group.id))
    })

    it('returns null for several groups, unknown ids or no ids', async () => {
      expect(await singleRootGroupIdForGroupIds([group.id, otherGroup.id])).to.be.null
      expect(await singleRootGroupIdForGroupIds([group.id, '99999999'])).to.be.null
      expect(await singleRootGroupIdForGroupIds([])).to.be.null
    })
  })

  describe('assertCanAllowGroupAdminEdits', () => {
    it('allows a content manager posting to one group', async () => {
      await assertCanAllowGroupAdminEdits(contentManager.id, [group.id, space.id])
    })

    it('rejects a member without Manage Content', async () => {
      await expect(assertCanAllowGroupAdminEdits(member.id, [group.id])).to.be.rejectedWith(/manage content/)
    })

    it('rejects posts going to more than one group', async () => {
      await expect(assertCanAllowGroupAdminEdits(contentManager.id, [group.id, otherGroup.id])).to.be.rejectedWith(/single group/)
    })
  })
})
