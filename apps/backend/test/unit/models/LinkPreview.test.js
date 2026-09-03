/* globals LinkPreview */
import { spyify, unspyify, mockify } from '../../setup/helpers'
import factories from '../../setup/factories'
require('../../setup')

describe('LinkPreview', () => {
  describe('populate', () => {
    const url = 'http://foo.com/bar'
    var preview

    beforeEach(() => {
      // getLinkPreview is bound at module load; mock the model method instead of link-preview-js
      mockify(LinkPreview, 'populate', async ({ id }) => {
        const p = await LinkPreview.find(id)
        return p.save({
          title: 'wow!',
          description: 'it\'s amazing',
          image_url: 'http://fake.host/wow.png',
          updated_at: new Date(),
          done: true
        })
      })
      preview = LinkPreview.forge({url})
      return preview.save()
    })

    afterEach(() => unspyify(LinkPreview, 'populate'))

    it('works', () => {
      return LinkPreview.populate({id: preview.id})
      .then(preview => {
        expect(preview.get('title')).to.equal('wow!')
      })
    })
  })

  describe('queue', () => {
    const url = 'http://foo.com/bar2'

    beforeEach(() => spyify(Queue, 'classMethod'))
    afterEach(() => unspyify(Queue, 'classMethod'))

    it('works for a new url', () => {
      return LinkPreview.queue(url)
      .then(() => LinkPreview.find(url))
      .then(preview => {
        expect(preview).to.exist

        expect(Queue.classMethod).to.have.been.called
        .with('LinkPreview', 'populate', {id: preview.id}, 0)
      })
    })

    it('does nothing for an existing url', () => {
      const url3 = 'http://foo.com/bar3'
      return LinkPreview.forge({url: url3}).save()
      .then(() => LinkPreview.queue(url3))
      .then(() => expect(Queue.classMethod).not.to.have.been.called())
    })
  })

  describe('findOrCreateAndPopulate', () => {
    it('returns an already-populated preview without re-fetching', async () => {
      const url = 'http://foo.com/already-done'
      const existing = await LinkPreview.forge({
        url,
        title: 'Done',
        done: true
      }).save()
      mockify(LinkPreview, 'populate', async () => existing)
      try {
        const preview = await LinkPreview.findOrCreateAndPopulate(url)
        expect(preview.id).to.equal(existing.id)
        expect(LinkPreview.populate).not.to.have.been.called()
      } finally {
        unspyify(LinkPreview, 'populate')
      }
    })

    it('creates and populates a new preview', async () => {
      const url = 'http://foo.com/new-preview'
      mockify(LinkPreview, 'populate', async ({ id }) => {
        const p = await LinkPreview.find(id)
        return p.save({ title: 'Fresh', done: true, updated_at: new Date() })
      })
      try {
        const preview = await LinkPreview.findOrCreateAndPopulate(url)
        expect(preview.get('url')).to.equal(url)
        expect(preview.get('title')).to.equal('Fresh')
        expect(preview.get('done')).to.equal(true)
        expect(LinkPreview.populate).to.have.been.called()
      } finally {
        unspyify(LinkPreview, 'populate')
      }
    })
  })

  describe('parseHyloPostId', () => {
    it('reads the post id from known Hylo hosts', () => {
      expect(LinkPreview.parseHyloPostId('https://hylo.com/post/42')).to.equal('42')
      expect(LinkPreview.parseHyloPostId('https://www.hylo.com/groups/foo/post/99')).to.equal('99')
      expect(LinkPreview.parseHyloPostId('http://localhost:3000/public/post/7')).to.equal('7')
    })

    it('returns null for non-Hylo URLs and non-post paths', () => {
      expect(LinkPreview.parseHyloPostId('https://example.com/post/42')).to.equal(null)
      expect(LinkPreview.parseHyloPostId('https://hylo.com/groups/foo')).to.equal(null)
    })
  })

  describe('attrsForPublicHyloPost', () => {
    it('returns title, body text, and first image for a public post', async () => {
      const post = await factories.post({
        name: 'Garden day',
        description: '<p>Come help <strong>plant</strong> trees.</p>',
        is_public: true
      }).save()
      await factories.media({
        post_id: post.id,
        type: 'image',
        url: 'http://cdn.example/first.jpg',
        position: 0
      }).save()

      const attrs = await LinkPreview.attrsForPublicHyloPost(`https://hylo.com/post/${post.id}`)
      expect(attrs.title).to.equal('Garden day')
      expect(attrs.description).to.include('Come help plant trees')
      expect(attrs.image_url).to.equal('http://cdn.example/first.jpg')
    })

    it('returns null for a private post', async () => {
      const post = await factories.post({
        name: 'Secret',
        is_public: false
      }).save()

      const attrs = await LinkPreview.attrsForPublicHyloPost(`https://hylo.com/post/${post.id}`)
      expect(attrs).to.equal(null)
    })
  })
})
