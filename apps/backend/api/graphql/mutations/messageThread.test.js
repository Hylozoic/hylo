import '../../../test/setup'
import factories from '../../../test/setup/factories'
import { leaveMessageThread } from './messageThread'
import { findThread } from '../../models/post/findOrCreateThread'

describe('leaveMessageThread', () => {
  let alice, bob, thread

  before(async () => {
    alice = await factories.user().save()
    bob = await factories.user().save()
    thread = await factories.post({ type: Post.Type.THREAD, user_id: alice.id }).save()
    await thread.addFollowers([alice.id, bob.id])
  })

  it('removes the viewer from the conversation and keeps the other person in it', async () => {
    const result = await leaveMessageThread(alice.id, thread.id)
    expect(result).to.deep.equal({ success: true })

    const followers = await thread.followers().fetch()
    expect(followers.pluck('id').map(String)).to.deep.equal([String(bob.id)])

    const followed = await PostUser.followedPostIds(alice.id).pluck('post_id')
    expect(followed.map(String)).not.to.include(String(thread.id))
  })

  it('means messaging the same person again starts a new conversation', async () => {
    const existing = await findThread([alice.id, bob.id])
    expect(existing).to.equal(null)
  })

  it('rejects someone who is not in the conversation', () => {
    return leaveMessageThread(alice.id, thread.id)
      .then(() => expect.fail('should reject'))
      .catch(e => expect(e.message).to.match(/not a participant/))
  })

  it('rejects a post that is not a conversation', async () => {
    const post = await factories.post({ type: 'discussion', user_id: alice.id }).save()
    return leaveMessageThread(alice.id, post.id)
      .then(() => expect.fail('should reject'))
      .catch(e => expect(e.message).to.match(/Message thread not found/))
  })
})
