/* eslint-disable no-unused-expressions, object-curly-spacing */
/* globals LinkPreview */
import { spyify, unspyify } from '../../setup/helpers'
const linkPreviewJs = require('link-preview-js')
require('../../setup')

describe('LinkPreview', () => {
  describe('populate', () => {
    const url = 'http://foo.com/bar'
    var preview

    beforeEach(() => {
      const mockPreviewData = {
        title: 'wow!',
        description: "it's amazing",
        images: ['http://fake.host/wow.png']
      }
      spyify(linkPreviewJs, 'getLinkPreview', () => Promise.resolve(mockPreviewData))
      preview = LinkPreview.forge({ url })
      return preview.save()
    })

    afterEach(() => unspyify(linkPreviewJs, 'getLinkPreview'))

    it('works', () => {
      return LinkPreview.populate({ id: preview.id })
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
            .with('LinkPreview', 'populate', { id: preview.id }, 0)
        })
    })

    it('does nothing for an existing url', () => {
      const url3 = 'http://foo.com/bar3'
      return LinkPreview.forge({ url: url3 }).save()
        .then(() => LinkPreview.queue(url3))
        .then(() => expect(Queue.classMethod).not.to.have.been.called())
    })
  })
})
