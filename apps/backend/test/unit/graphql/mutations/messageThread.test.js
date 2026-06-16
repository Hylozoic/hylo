import '../../../setup'
import factories from '../../../setup/factories'
import { muteMessageThread, unmuteMessageThread } from '../../../../api/graphql/mutations/messageThread'

describe('muteMessageThread', () => {
  let user, otherUser, thread

  before(async () => {
    user = await factories.user().save()
    otherUser = await factories.user().save()
    thread = await factories.post({ type: Post.Type.THREAD, user_id: user.id }).save()
    await thread.addFollowers([user.id, otherUser.id])
  })

  it('mutes the thread for the user', async () => {
    await muteMessageThread(user.id, thread.id)

    const postUser = await PostUser.find(thread.id, user.id)
    expect(postUser.get('muted_at')).to.exist
    expect(postUser.get('following')).to.equal(true)
    expect(postUser.get('active')).to.equal(true)

    const followers = await thread.followers().fetch()
    expect(followers.pluck('id')).to.include.members([user.id, otherUser.id])
  })

  it('throws if the thread does not exist', async () => {
    let err
    try {
      await muteMessageThread(user.id, '999999')
    } catch (error) {
      err = error
    }
    expect(err.message).to.equal('Message thread not found')
  })

  it('throws if the user is not a participant', async () => {
    const outsider = await factories.user().save()
    let err
    try {
      await muteMessageThread(outsider.id, thread.id)
    } catch (error) {
      err = error
    }
    expect(err.message).to.equal('You are not a participant in this thread')
  })
})

describe('unmuteMessageThread', () => {
  let user, thread

  before(async () => {
    user = await factories.user().save()
    thread = await factories.post({ type: Post.Type.THREAD, user_id: user.id }).save()
    await thread.addFollowers([user.id])
    await muteMessageThread(user.id, thread.id)
  })

  it('unmutes the thread for the user', async () => {
    await unmuteMessageThread(user.id, thread.id)

    const postUser = await PostUser.find(thread.id, user.id)
    expect(postUser.get('muted_at')).to.equal(null)
  })
})
