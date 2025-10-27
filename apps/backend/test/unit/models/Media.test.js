/* eslint-disable no-unused-expressions */
var root = require('root-path')
var nock = require('nock')
require(root('test/setup'))
var factories = require(root('test/setup/factories'))

describe('Media', () => {
  describe('.createForSubject', () => {
    var post
    beforeEach(() => {
      post = factories.post()
      return post.save()
    })

    it('works as expected', function () {
      // Mock Vimeo oEmbed API response
      nock('https://vimeo.com')
        .get('/api/oembed.json')
        .query({ url: 'https://vimeo.com/70509133' })
        .reply(200, {
          type: 'video',
          thumbnail_url: 'https://i.vimeocdn.com/video/555280788-3f8ee9b5a9a54434acff9809c8ab998c22d26487171a868747a1ac4220a15110-d_640',
          width: 640,
          height: 360
        })

      return Media.createForSubject({
        subjectType: 'post',
        subjectId: post.id,
        type: 'video',
        url: 'https://vimeo.com/70509133',
        position: 7
      })
        .tap(video => video.load('post'))
        .then(video => {
          expect(video.id).to.exist
          expect(video.get('width')).to.equal(640)
          expect(video.get('height')).to.equal(360)
          expect(video.get('position')).to.equal(7)
          expect(video.relations.post).to.exist
          expect(video.relations.post.id).to.equal(post.id)
        })
    })
  })

  describe('.findMediaUrlsForUser', () => {
    let user, post
    beforeEach(async () => {
      // Mock Vimeo oEmbed API response - needs to be set up BEFORE creating the media
      const scope = nock('https://vimeo.com')
        .persist(true)
        .get('/api/oembed.json')
        .query(true)
        .reply(200, JSON.stringify({
          type: 'video',
          thumbnail_url: 'https://i.vimeocdn.com/video/555280788-3f8ee9b5a9a54434acff9809c8ab998c22d26487171a868747a1ac4220a15110-d_640',
          width: 640,
          height: 360
        }))

      user = await new User({ name: 'username', email: 'john@foo.com', active: true }).save()
      post = await factories.post({ description: '<p>hello <a class="mention" data-type="mention" data-id="334" data-label="John Doe">John Doe</a> #MOO</p>', user_id: user.id }).save()

      // Create media with mocked HTTP response
      await Media.createForSubject({
        subjectType: 'post',
        subjectId: post.id,
        type: 'video',
        url: 'https://vimeo.com/70509133',
        position: 7
      })

      // Remove the persistent mock after creating the media
      scope.persist(false)
    })

    afterEach(() => {
      nock.cleanAll()
      nock.restore()
    })

    it('returns the correct urls', async () => {
      const mediaUrls = await Media.findMediaUrlsForUser(user.id)
      const expectedUrls = ['https://vimeo.com/70509133', 'https://i.vimeocdn.com/video/555280788-3f8ee9b5a9a54434acff9809c8ab998c22d26487171a868747a1ac4220a15110-d_640']
      expect(mediaUrls).to.deep.equal(expectedUrls)
    })
  })
})
