/* globals LinkPreview */
import { spyify, unspyify, mockify } from '../../setup/helpers'
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
})
