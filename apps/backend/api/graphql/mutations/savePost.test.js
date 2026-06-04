import '../../../test/setup'
import setup from '../../../test/setup'
import factories from '../../../test/setup/factories'
import { savePost, unsavePost } from './savePost'

describe('savePost mutations', () => {
  let user, post

  before(async () => {
    user = await factories.user().save()
    post = await factories.post({ user_id: user.id }).save()
  })

  after(async () => setup.clearDb())

  it('creates PostUser with saved_at when none exists', async () => {
    await savePost(user.id, post.id)
    const pu = await PostUser.find(post.id, user.id)
    expect(pu).to.exist
    expect(pu.get('saved_at')).to.exist
  })

  it('updates saved_at when PostUser already exists', async () => {
    const before = await PostUser.find(post.id, user.id)
    const prev = before.get('saved_at')
    await new Promise(r => setTimeout(r, 5))
    await savePost(user.id, post.id)
    const after = await PostUser.find(post.id, user.id)
    expect(after.get('saved_at').getTime()).to.be.at.least(prev.getTime())
  })

  it('clears saved_at on unsavePost', async () => {
    await unsavePost(user.id, post.id)
    const pu = await PostUser.find(post.id, user.id)
    expect(pu.get('saved_at')).to.equal(null)
  })

  it('throws when post is not found for savePost', async () => {
    try {
      await savePost(user.id, 999999999)
      expect.fail('should throw')
    } catch (e) {
      expect(e.message).to.match(/Post not found/)
    }
  })

  it('throws when post is not found for unsavePost', async () => {
    try {
      await unsavePost(user.id, 999999999)
      expect.fail('should throw')
    } catch (e) {
      expect(e.message).to.match(/Post not found/)
    }
  })
})
