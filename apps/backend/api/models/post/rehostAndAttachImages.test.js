/* eslint-disable no-unused-expressions */
import rehostAndAttachImages from './rehostAndAttachImages'
import * as rehostRemoteMedia from '../../../lib/uploader/rehostRemoteMedia'
const rootPath = require('root-path')
const setup = require(rootPath('test/setup'))
const factories = require(rootPath('test/setup/factories'))
const { mockify, unspyify, stubGetImageSize } = require(rootPath('test/setup/helpers'))

describe('rehostAndAttachImages', () => {
  let user, post
  const hostedUrl = 'https://cdn.hylo.com/evo-uploads/user/1/post/new/rehosted.png'

  before(() =>
    setup.clearDb()
      .then(() => new User({ name: 'U1', email: 'rehost@b.c', active: true }).save())
      .then(u => {
        user = u
        post = factories.post({ user_id: u.id })
        return post.save()
      })
  )

  beforeEach(() => {
    mockify(rehostRemoteMedia, 'rehostRemoteUrl', async () => hostedUrl)
    mockify(Post, 'afterRelatedMutation', () => {})
    stubGetImageSize(hostedUrl)
  })

  afterEach(async () => {
    unspyify(rehostRemoteMedia, 'rehostRemoteUrl')
    unspyify(Post, 'afterRelatedMutation')
    await bookshelf.knex('media').where({ post_id: post.id }).del()
  })

  it('uploads remote URLs, attaches media, and publishes a post update', async () => {
    await rehostAndAttachImages({
      postId: post.id,
      userId: user.id,
      imageUrls: ['https://v5.airtableusercontent.com/v1/foo/photo.jpg'],
      startPosition: 0
    })

    await post.load('media')
    const images = post.relations.media.filter(m => m.get('type') === 'image')
    expect(images.length).to.equal(1)
    expect(images[0].get('url')).to.equal(hostedUrl)
    expect(images[0].get('position')).to.equal(0)
    expect(rehostRemoteMedia.rehostRemoteUrl).to.have.been.called.with(
      'https://v5.airtableusercontent.com/v1/foo/photo.jpg',
      { userId: user.id }
    )
    expect(Post.afterRelatedMutation).to.have.been.called.with(post.id, { changeContext: 'edit' })
  })

  it('attaches each remote URL at successive positions', async () => {
    stubGetImageSize(hostedUrl)
    await rehostAndAttachImages({
      postId: post.id,
      userId: user.id,
      imageUrls: [
        'https://upload.wikimedia.org/wikipedia/commons/cow.jpg',
        'https://encrypted-tbn0.gstatic.com/images?q=tbn:abc'
      ],
      startPosition: 0
    })

    await post.load('media')
    const images = post.relations.media
      .filter(m => m.get('type') === 'image')
      .sort((a, b) => a.get('position') - b.get('position'))
    expect(images.length).to.equal(2)
    expect(images[0].get('position')).to.equal(0)
    expect(images[1].get('position')).to.equal(1)
    expect(rehostRemoteMedia.rehostRemoteUrl).to.have.been.called.twice
  })

  it('skips positions that already have an image so retries do not duplicate', async () => {
    stubGetImageSize(hostedUrl)
    await Media.createForSubject({
      subjectType: 'post',
      subjectId: post.id,
      type: 'image',
      url: hostedUrl,
      position: 0
    })

    await rehostAndAttachImages({
      postId: post.id,
      userId: user.id,
      imageUrls: ['https://v5.airtableusercontent.com/v1/foo/photo.jpg'],
      startPosition: 0
    })

    await post.load('media')
    const images = post.relations.media.filter(m => m.get('type') === 'image')
    expect(images.length).to.equal(1)
    expect(rehostRemoteMedia.rehostRemoteUrl).not.to.have.been.called
    expect(Post.afterRelatedMutation).not.to.have.been.called
  })

  it('throws when the post is not found so the job can retry', async () => {
    try {
      await rehostAndAttachImages({
        postId: 999999999,
        userId: user.id,
        imageUrls: ['https://v5.airtableusercontent.com/v1/foo/photo.jpg']
      })
      expect.fail('should throw')
    } catch (e) {
      expect(e.message).to.match(/post 999999999 not found/)
    }
  })

  it('throws after a failed rehost so kue retries remaining images', async () => {
    mockify(rehostRemoteMedia, 'rehostRemoteUrl', async () => {
      throw new Error('download failed')
    })

    try {
      await rehostAndAttachImages({
        postId: post.id,
        userId: user.id,
        imageUrls: ['https://v5.airtableusercontent.com/v1/foo/photo.jpg']
      })
      expect.fail('should throw')
    } catch (e) {
      expect(e.message).to.equal('download failed')
    }

    await post.load('media')
    expect(post.relations.media.length).to.equal(0)
    expect(Post.afterRelatedMutation).not.to.have.been.called
  })
})
