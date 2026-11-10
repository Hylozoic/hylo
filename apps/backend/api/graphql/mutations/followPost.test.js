/* eslint-disable no-unused-expressions */
import setup from '../../../test/setup'
import factories from '../../../test/setup/factories'
import { followPost, unfollowPost } from './followPost'

describe('followPost mutations', () => {
  let user, post

  before(async () => {
    user = await factories.user().save()
    post = await factories.post({ user_id: user.id }).save()
  })

  after(async () => setup.clearDb())

  it('creates a follower when none exists', async () => {
    await followPost(user.id, post.id)
    const pu = await PostUser.find(post.id, user.id)
    expect(pu).to.exist
    expect(pu.get('following')).to.equal(true)
    expect(pu.get('active')).to.equal(true)
  })

  it('turns following back on without clearing saved_at', async () => {
    const pu = await PostUser.find(post.id, user.id)
    await pu.save({ following: false, saved_at: new Date() })
    await followPost(user.id, post.id)
    const after = await PostUser.find(post.id, user.id)
    expect(after.get('following')).to.equal(true)
    expect(after.get('saved_at')).to.exist
  })

  it('turns following off and keeps saved_at and a project role', async () => {
    const project = await factories.post({ type: Post.Type.PROJECT, user_id: user.id }).save()
    await project.addProjectMembers([user.id])
    const before = await PostUser.find(project.id, user.id)
    await before.save({ saved_at: new Date() })

    await unfollowPost(user.id, project.id)

    const after = await PostUser.find(project.id, user.id)
    expect(after.get('following')).to.equal(false)
    expect(after.get('saved_at')).to.exist
    expect(after.get('project_role_id')).to.exist
    const members = await project.members().fetch()
    expect(members.pluck('id')).to.include(user.id)
  })

  it('does nothing when the user was never following', async () => {
    const other = await factories.user().save()
    await unfollowPost(other.id, post.id)
    expect(await PostUser.find(post.id, other.id)).to.equal(null)
  })

  it('throws when the post is not found', async () => {
    try {
      await followPost(user.id, 999999999)
      expect.fail('should throw')
    } catch (e) {
      expect(e.message).to.match(/Post not found/)
    }
  })

  it('throws when the user is not logged in', async () => {
    try {
      await unfollowPost(null, post.id)
      expect.fail('should throw')
    } catch (e) {
      expect(e.message).to.match(/logged in/)
    }
  })
})
