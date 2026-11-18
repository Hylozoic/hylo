import '../../../test/setup'
import factories from '../../../test/setup/factories'
import { createRequestHandler } from '../../../api/graphql'

describe('Post follow and unfollow', () => {
  let handler, reader, post

  before(async () => {
    handler = createRequestHandler()

    const author = await factories.user().save()
    reader = await factories.user().save()
    const group = await factories.group().save()
    await author.joinGroup(group)
    await reader.joinGroup(group)
    post = await factories.post({ type: 'discussion', user_id: author.id }).save()
    await post.groups().attach(group)
    await post.addFollowers([reader.id])
  })

  async function runAs (viewer, document) {
    const req = factories.mock.request()
    req.url = '/noo/graphql'
    req.method = 'POST'
    req.headers = { 'Content-Type': 'application/json' }
    req.session = { userId: viewer.id, destroy: () => {} }
    req.user = viewer
    const res = factories.mock.response()

    const { executionResult } = await handler.inject({ document, serverContext: { req, res } })
    return executionResult
  }

  it('reports and changes whether the current user follows a post', async () => {
    const before = await runAs(reader, `{ post(id: "${post.id}") { id isFollowing } }`)
    expect(before.errors).to.equal(undefined)
    expect(before.data.post.isFollowing).to.equal(true)

    const unfollowed = await runAs(reader, `mutation { unfollowPost(postId: "${post.id}") { id isFollowing } }`)
    expect(unfollowed.errors).to.equal(undefined)
    expect(unfollowed.data.unfollowPost.isFollowing).to.equal(false)

    const followed = await runAs(reader, `mutation { followPost(postId: "${post.id}") { id isFollowing } }`)
    expect(followed.errors).to.equal(undefined)
    expect(followed.data.followPost.isFollowing).to.equal(true)
  })
})
