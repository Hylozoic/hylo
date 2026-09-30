import React from 'react'
import { render } from '@testing-library/react'
import HyloHTML from './HyloHTML'

describe('HyloHTML', () => {
  it('turns YouTube and Vimeo embeds into iframes', () => {
    const { container } = render(
      <HyloHTML html='<video data-type="embed" src="https://player.vimeo.com/video/70509133"></video>' />
    )
    expect(container.querySelector('iframe').getAttribute('src')).toBe('https://player.vimeo.com/video/70509133')
  })

  it('drops embeds from any other source', () => {
    const { container } = render(
      <HyloHTML html='<p>hi</p><video data-type="embed" src="javascript:alert(1)"></video><video data-type="embed" src="https://evil.example/"></video>' />
    )
    expect(container.querySelector('iframe')).toBeNull()
    expect(container.textContent).toBe('hi')
  })
})
