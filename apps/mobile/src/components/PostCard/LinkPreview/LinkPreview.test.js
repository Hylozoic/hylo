import React from 'react'
import ReactShallowRenderer from 'react-test-renderer/shallow'
import LinkPreview from './LinkPreview'

describe('LinkPreview', () => {
  it('matches snapshot', () => {
    const renderer = new ReactShallowRenderer()
    const props = {
      title: 'Good Link',
      url: 'http://www.goodlink.com/thepage',
      imageUrl: 'rarara.com/ra.png'
    }

    renderer.render(
      <LinkPreview {...props} />
    )

    const actual = renderer.getRenderOutput()

    expect(actual).toMatchSnapshot()
  })
})
