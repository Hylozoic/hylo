import React from 'react'
import { render, screen } from 'util/testing/reactTestingLibraryExtended'
import ImageCarousel from './ImageCarousel'

describe('ImageCarousel', () => {
  it('renders nothing when there are no images', () => {
    render(<ImageCarousel attachments={[
      { url: 'bonkerz', type: 'file' },
      { url: 'bonkers', type: 'file' },
      { url: 'bonkerzztop', type: 'file' }
    ]}
           />)

    expect(screen.queryByRole('img')).not.toBeInTheDocument()
  })

  it('renders a single image', () => {
    render(<ImageCarousel attachments={[
      { url: 'foo', type: 'image' },
      { url: 'bonkerz', type: 'file' }
    ]}
           />)

    const image = screen.getByRole('img')
    expect(image).toBeInTheDocument()
    expect(image).toHaveAttribute('src', 'foo')
    expect(image).toHaveAttribute('alt', 'Attached image 1')
  })

  it('renders multiple images, but only shows first one', () => {
    render(<ImageCarousel attachments={[
      { url: 'bar', type: 'image' },
      { url: 'baz', type: 'image' },
      { url: 'bonk', type: 'image' },
      { url: 'bonkerz', type: 'file' }
    ]}
           />)

    const images = screen.getAllByRole('img')
    expect(images).toHaveLength(1)
    expect(images[0]).toHaveAttribute('src', 'bar')
  })
})
