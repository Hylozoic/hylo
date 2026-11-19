import '../../../test/setup'
import factories from '../../../test/setup/factories'

describe('Project Mixin', () => {
  describe('addPostMembers', () => {
    var project, user
    before(async function () {
      user = factories.user()
      await user.save()
      project = factories.post({type: Post.Type.PROJECT})
      await project.save()
    })

    it('removes a user from a project', async () => {
      await project.addPostMembers([user.id])
      const members = await project.members().fetch()
      expect(members.length).to.equal(1)
      expect(members.first().id).to.equal(user.id)
    })
  })

  describe('removePostMembers', () => {
    var user, project

    before(async function () {
      user = factories.user()
      await user.save()
      project = factories.post({type: Post.Type.PROJECT})
      await project.save()
      await project.addPostMembers([user.id])
    })

    it('removes a user from a project', async () => {
      await project.removePostMembers([user.id])
      const members = await project.members().fetch()
      expect(members.length).to.equal(0)
    })
  })

  describe('setPostMembers', () => {
    var user1, user2, user3, project

    before(async function () {
      user1 = factories.user()
      await user1.save()
      user2 = factories.user()
      await user2.save()
      user3 = factories.user()
      await user3.save()
      project = factories.post({type: Post.Type.PROJECT})
      await project.save()
      await project.addPostMembers([user1.id, user2.id])
    })

    it('sets the members of a project', async () => {
      await project.setPostMembers([user2.id, user3.id])
      const members = await project.members().fetch()
      expect(members.length).to.equal(2)
      expect(members.map('id').sort()).to.deep.equal([user2.id, user3.id].sort())
    })
  })
})