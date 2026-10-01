import '../../../test/setup'
import factories from '../../../test/setup/factories'
import { createRequestHandler } from '../../../api/graphql'
import postTeaser from '../../../api/graphql/queries/postTeaser'

describe('postTeaser', () => {
  let handler, author, publicGroup, protectedGroup, hiddenGroup

  const makeGroup = attrs => factories.group({ active: true, ...attrs }).save()
  const makePost = async (groups, attrs = {}) => {
    const post = await factories.post({ type: 'discussion', user_id: author.id, is_public: false, ...attrs }).save()
    for (const group of groups) await post.groups().attach(group.id)
    return post
  }

  before(async () => {
    handler = createRequestHandler()
    author = await factories.user().save()
    publicGroup = await makeGroup({ name: 'Open Garden', visibility: Group.Visibility.PUBLIC, avatar_url: 'https://example.com/garden.png' })
    protectedGroup = await makeGroup({ name: 'Quiet Room', visibility: Group.Visibility.PROTECTED })
    hiddenGroup = await makeGroup({ name: 'Secret Circle', visibility: Group.Visibility.HIDDEN })
  })

  async function runSignedOut (document) {
    const req = factories.mock.request()
    req.url = '/noo/graphql'
    req.method = 'POST'
    req.headers = { 'Content-Type': 'application/json' }
    req.session = { destroy: () => {} }
    const res = factories.mock.response()
    const { executionResult } = await handler.inject({ document, serverContext: { req, res } })
    return executionResult
  }

  it('names a Public group to signed-out visitors, and only its name, slug and avatar', async () => {
    const post = await makePost([publicGroup])
    const result = await runSignedOut(`{ postTeaser(id: "${post.id}") { exists group { name slug avatarUrl } } }`)
    expect(result.errors).to.equal(undefined)
    expect(result.data.postTeaser).to.deep.equal({
      exists: true,
      group: { name: 'Open Garden', slug: publicGroup.get('slug'), avatarUrl: 'https://example.com/garden.png' }
    })
  })

  it('never names a Protected or Hidden group', async () => {
    for (const group of [protectedGroup, hiddenGroup]) {
      const post = await makePost([group])
      const result = await postTeaser(post.id)
      expect(result).to.deep.equal({ exists: true, group: null })
    }
  })

  it('in several groups, names only a Public one', async () => {
    const post = await makePost([hiddenGroup, protectedGroup, publicGroup])
    const result = await postTeaser(post.id)
    expect(result.exists).to.equal(true)
    expect(result.group.name).to.equal('Open Garden')

    const privateOnly = await makePost([hiddenGroup, protectedGroup])
    const privateResult = await postTeaser(privateOnly.id)
    expect(privateResult).to.deep.equal({ exists: true, group: null })
  })

  it('names a Public space only when its parent group is Public too', async () => {
    const hiddenParent = await makeGroup({ name: 'Hidden Parent', visibility: Group.Visibility.HIDDEN })
    const spaceOfHidden = await makeGroup({ name: 'Space Of Hidden', visibility: Group.Visibility.PUBLIC, type: 'space', parent_id: hiddenParent.id })
    const inHiddenSpace = await makePost([spaceOfHidden])
    expect(await postTeaser(inHiddenSpace.id)).to.deep.equal({ exists: true, group: null })

    const spaceOfPublic = await makeGroup({ name: 'Space Of Public', visibility: Group.Visibility.PUBLIC, type: 'space', parent_id: publicGroup.id })
    const inPublicSpace = await makePost([spaceOfPublic])
    const result = await postTeaser(inPublicSpace.id)
    expect(result.group.name).to.equal('Space Of Public')
  })

  it('says nothing about missing, removed or direct message posts, or bad ids', async () => {
    const removed = await makePost([publicGroup], { active: false })
    const thread = await factories.post({ type: Post.Type.THREAD, user_id: author.id }).save()
    for (const id of [removed.id, thread.id, '999999999', 'abc', null]) {
      expect(await postTeaser(id)).to.deep.equal({ exists: false, group: null })
    }
    const result = await runSignedOut('{ postTeaser(id: "999999999") { exists group { name } } }')
    expect(result.data.postTeaser).to.deep.equal({ exists: false, group: null })
  })

  it('ignores a Public group that is no longer active', async () => {
    const closed = await makeGroup({ name: 'Closed Club', visibility: Group.Visibility.PUBLIC })
    const post = await makePost([closed])
    await closed.save({ active: false }, { patch: true })
    expect(await postTeaser(post.id)).to.deep.equal({ exists: false, group: null })
  })
})
