import React from 'react'
import CardImageAttachments from './CardImageAttachments'
import { render, screen, waitFor, within } from 'util/testing/reactTestingLibraryExtended'
import userEvent from '@testing-library/user-event'

describe('CardImageAttachments', () => {
  it('renders no images when there are no image attachments', () => {
    const { container } = render(<CardImageAttachments attachments={[
      { url: 'bonkerz', type: 'file' },
      { url: 'bonkers', type: 'file' },
      { url: 'bonkerzztop', type: 'file' }
    ]}
                                 />)
    expect(container.firstChild).toBeNull()
  })

  it('renders a single image', () => {
    render(<CardImageAttachments attachments={[
      { url: 'foo', type: 'image' },
      { url: 'bonkerz', type: 'file' }
    ]}
           />)
    expect(screen.getByAltText('Attached image 1')).toBeInTheDocument()
    expect(screen.queryByAltText('Attached image 2')).not.toBeInTheDocument()
  })

  it('renders multiple images', () => {
    render(<CardImageAttachments attachments={[
      { url: 'bar', type: 'image' },
      { url: 'baz', type: 'image' },
      { url: 'bonk', type: 'image' },
      { url: 'bonkerz', type: 'file' }
    ]}
           />)
    expect(screen.getByAltText('Attached image 1')).toBeInTheDocument()
    expect(screen.getByAltText('Attached image 2')).toBeInTheDocument()
    expect(screen.getByAltText('Attached image 3')).toBeInTheDocument()
    expect(screen.queryByAltText('Attached image 4')).not.toBeInTheDocument()
  })

  it('displays lightbox when image is clicked', async () => {
    render(<CardImageAttachments attachments={[
      { url: 'bar', type: 'image' },
      { url: 'baz', type: 'image' },
      { url: 'bonk', type: 'image' },
      { url: 'bonkerz', type: 'file' }
    ]}
           />)

    userEvent.click(screen.getByAltText('Attached image 2'))

    await waitFor(() => {
      expect(document.querySelector('.yarl__root')).toBeInTheDocument()
    })

    const currentSlide = document.querySelector('.yarl__slide_current img')
    expect(currentSlide).toHaveAttribute('src', 'baz')
  })

  it('moves between images in the lightbox', async () => {
    render(<CardImageAttachments attachments={[
      { url: 'bar', type: 'image' },
      { url: 'baz', type: 'image' },
      { url: 'bonk', type: 'image' }
    ]}
           />)

    userEvent.click(screen.getByTestId('first-image'))

    await waitFor(() => {
      expect(document.querySelector('.yarl__root')).toBeInTheDocument()
    })

    const lightbox = document.querySelector('.yarl__root')
    userEvent.click(within(lightbox).getByLabelText('Next'))

    await waitFor(() => {
      expect(document.querySelector('.yarl__slide_current img')).toHaveAttribute('src', 'baz')
    })
  })

  it('does not display lightbox when image is clicked from postCard', async () => {
    render(<CardImageAttachments
      attachments={[
        { url: 'bar', type: 'image' },
        { url: 'baz', type: 'image' },
        { url: 'bonk', type: 'image' }
      ]} className='post-card'
           />)

    userEvent.click(screen.getByAltText('Attached image 1'))

    await waitFor(() => {
      expect(document.querySelector('.yarl__root')).not.toBeInTheDocument()
    })
  })

  it('uses thumbnailUrl for chat tiles when available', () => {
    render(<CardImageAttachments
      forChatPost
      attachments={[
        { url: 'full-a', thumbnailUrl: 'thumb-a', type: 'image' },
        { url: 'full-b', type: 'image' }
      ]}
           />)

    expect(screen.getByLabelText('full-a')).toHaveStyle({ backgroundImage: 'url(thumb-a)' })
    expect(screen.getByLabelText('full-b')).toHaveStyle({ backgroundImage: 'url(full-b)' })
  })
})
