import '../../../setup'
import factories from '../../../setup/factories'
import { leaveMessageThread } from '../../../../api/graphql/mutations/messageThread'

describe('leaveMessageThread', () => {
  let user, otherUser, thread

  before(async () => {
    user = await factories.user().save()
    otherUser = await factories.user().save()
    thread = await factories.post({ type: Post.Type.THREAD, user_id: user.id }).save()
    await thread.addFollowers([user.id, otherUser.id])
  })

  it('removes the user from the thread', async () => {
    await leaveMessageThread(user.id, thread.id)

    const followers = await thread.followers().fetch()
    expect(followers.pluck('id')).to.deep.equal([otherUser.id])

    const postUser = await PostUser.find(thread.id, user.id)
    expect(postUser.get('following')).to.equal(false)
    expect(postUser.get('active')).to.equal(false)
  })

  it('throws if the thread does not exist', async () => {
    let err
    try {
      await leaveMessageThread(user.id, '999999')
    } catch (error) {
      err = error
    }
    expect(err.message).to.equal('Message thread not found')
  })

  it('throws if the user is not a participant', async () => {
    const outsider = await factories.user().save()
    let err
    try {
      await leaveMessageThread(outsider.id, thread.id)
    } catch (error) {
      err = error
    }
    expect(err.message).to.equal('You are not a participant in this thread')
  })
})
