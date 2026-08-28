import createPost, { afterCreatingPost } from './createPost'
const rootPath = require('root-path')
const setup = require(rootPath('test/setup'))
const factories = require(rootPath('test/setup/factories'))
const { spyify, stubGetImageSize, mockify, unspyify } = require(rootPath('test/setup/helpers'))

describe('afterCreatingPost', () => {
  let post
  const videoUrl = 'https://www.youtube.com/watch?v=jsQ7yKwDPZk'

  before(() =>
    setup.clearDb()
      .then(() => Promise.props({
        requestTag: Tag.forge({ name: 'request' }).save(),
        u1: new User({ name: 'U1', email: 'a@b.c', active: true }).save(),
      }))
      .then(props => {
        post = factories.post({ user_id: props.u1.id, description: 'wow!', link_preview_id: null })
      })
  )

  beforeEach(() => {
    spyify(Queue, 'classMethod')
  })

  after(() => unspyify(Queue, 'classMethod'))

  it('works', () => {
    return Media.generateThumbnailUrl(videoUrl)
      .then(url => stubGetImageSize(url))
      .then(() => bookshelf.transaction(trx =>
        post.save({}, { transacting: trx })
          .then(() =>
            afterCreatingPost(post, {
              groups: [],
              videoUrl,
              children: [
                {
                  id: 'new-whatever',
                  name: 'bob',
                  description: 'is your uncle'
                }
              ],
              transacting: trx
            }))))
      .then(() => post.load(['media', 'children']))
      .then(() => {
        const video = post.relations.media.first()
        expect(video).to.exist
        expect(video.get('url')).to.equal(videoUrl)

        const child = post.relations.children.first()
        expect(child).to.exist
        expect(child.get('name')).to.equal('bob')
        expect(child.details()).to.equal('is your uncle')

        expect(Queue.classMethod).to.have.been.called
          .with('Post', 'incrementNewPostCountForCreatedPost', { postId: post.id }, 0)
        expect(Queue.classMethod).to.have.been.called
          .with('Post', 'createActivities', { postId: post.id })
      })
  })

  it('ignores duplicate group ids', () => {
    const c = factories.group()
    return c.save()
    .then(() => post.save())
    .then(() => afterCreatingPost(post, {group_ids: [c.id, c.id]}))
    .then(() => post.load('groups'))
    .then(() => expect(post.relations.groups.length).to.equal(1))
    .catch(err => {
      throw err
    })
  })

  it('queues a link preview when the post has a URL and no preview', () => {
    const linkedPost = factories.post({
      user_id: post.get('user_id'),
      description: 'Check https://example.com/from-zapier',
      link_preview_id: null
    })
    return linkedPost.save()
      .then(() => afterCreatingPost(linkedPost, { group_ids: [] }))
      .then(() => {
        expect(Queue.classMethod).to.have.been.called
          .with('Post', 'generateLinkPreview', { postId: linkedPost.id, url: 'https://example.com/from-zapier' }, 0)
      })
  })

  it('attaches an existing populated preview instead of queuing', async () => {
    const url = 'https://example.com/already-cached'
    const preview = await LinkPreview.forge({ url, title: 'Cached', done: true }).save()
    const linkedPost = await factories.post({
      user_id: post.get('user_id'),
      description: `See ${url}`,
      link_preview_id: null
    }).save()

    await afterCreatingPost(linkedPost, { group_ids: [] })
    await linkedPost.refresh()

    expect(String(linkedPost.get('link_preview_id'))).to.equal(String(preview.id))
    expect(Queue.classMethod).not.to.have.been.called.with('Post', 'generateLinkPreview')
  })

  it('does not queue a link preview when one is already set', async () => {
    const preview = await LinkPreview.forge({
      url: 'https://example.com/skip-me',
      title: 'Skip',
      done: true
    }).save()
    const previewedPost = await factories.post({
      user_id: post.get('user_id'),
      description: 'Check https://example.com/skip-me',
      link_preview_id: preview.id
    }).save()

    await afterCreatingPost(previewedPost, { group_ids: [] })
    expect(Queue.classMethod).not.to.have.been.called.with('Post', 'generateLinkPreview')
  })

  it('does not attach or queue a preview when skip_link_preview is set', async () => {
    const url = 'https://example.com/manually-removed'
    await LinkPreview.forge({ url, title: 'Cached', done: true }).save()
    const linkedPost = await factories.post({
      user_id: post.get('user_id'),
      description: `See ${url}`,
      link_preview_id: null
    }).save()

    await afterCreatingPost(linkedPost, { group_ids: [], skip_link_preview: true })
    await linkedPost.refresh()

    expect(linkedPost.get('link_preview_id')).to.not.exist
    expect(Queue.classMethod).not.to.have.been.called.with('Post', 'generateLinkPreview')
  })
})

describe('Post.generateLinkPreview', () => {
  let user

  before(() =>
    setup.clearDb()
      .then(() => new User({ name: 'U1', email: 'lp@b.c', active: true }).save())
      .then(u => { user = u })
  )

  it('attaches a populated preview to the post', async () => {
    const url = 'https://example.com/from-job'
    const linkedPost = await factories.post({
      user_id: user.id,
      description: `See ${url}`,
      link_preview_id: null
    }).save()

    mockify(LinkPreview, 'findOrCreateAndPopulate', async () => {
      return LinkPreview.forge({ url, title: 'From job', done: true }).save()
    })
    try {
      await Post.generateLinkPreview({ postId: linkedPost.id, url })
      await linkedPost.refresh()
      const preview = await LinkPreview.find(linkedPost.get('link_preview_id'))
      expect(preview.get('title')).to.equal('From job')
    } finally {
      unspyify(LinkPreview, 'findOrCreateAndPopulate')
    }
  })

  it('does nothing when the preview has no title', async () => {
    const url = 'https://example.com/no-title'
    const linkedPost = await factories.post({
      user_id: user.id,
      description: `See ${url}`,
      link_preview_id: null
    }).save()

    mockify(LinkPreview, 'findOrCreateAndPopulate', async () => {
      return LinkPreview.forge({ url, done: true }).save()
    })
    try {
      await Post.generateLinkPreview({ postId: linkedPost.id, url })
      await linkedPost.refresh()
      expect(linkedPost.get('link_preview_id')).to.not.exist
    } finally {
      unspyify(LinkPreview, 'findOrCreateAndPopulate')
    }
  })
})


describe('createPost accepted_post_types', () => {
  let user, restrictedGroup

  before(() =>
    setup.clearDb()
      .then(() => Promise.props({
        u: new User({ name: 'U1', email: 'apt@b.c', active: true }).save(),
        g: new Group({ slug: 'apt-events-only', name: 'Events Only', accepted_post_types: ['event'] }).save()
      }))
      .then(props => {
        user = props.u
        restrictedGroup = props.g
        return user.joinGroup(restrictedGroup)
      })
  )

  it('rejects a type the destination group does not accept', () => {
    return createPost(user.id, {
      name: 'Nope',
      type: Post.Type.DISCUSSION,
      group_ids: [restrictedGroup.id]
    })
      .then(() => expect.fail('should reject'))
      .catch(e => expect(e.message).to.match(/Events Only does not accept discussion posts/))
  })

  it('creates the post when the group accepts the type', () => {
    return createPost(user.id, {
      name: 'Party',
      type: Post.Type.EVENT,
      group_ids: [restrictedGroup.id],
      startTime: Date.now() + 86400000,
      endTime: Date.now() + 90000000
    }).then(post => {
      expect(post).to.exist
      expect(post.get('type')).to.equal(Post.Type.EVENT)
    })
  })
})
