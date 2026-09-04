import React from 'react'
import CardImageAttachments from './CardImageAttachments'
import { render, screen, waitFor } from 'util/testing/reactTestingLibraryExtended'
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

  it('displays modal when image is clicked', async () => {
    render(<CardImageAttachments attachments={[
      { url: 'bar', type: 'image' },
      { url: 'baz', type: 'image' },
      { url: 'bonk', type: 'image' },
      { url: 'bonkerz', type: 'file' }
    ]}
           />)

    userEvent.click(screen.getByAltText('Attached image 2'))

    // The lightbox shows only the clicked image, not every attachment
    await waitFor(() => {
      expect(screen.getByTestId('sc-img1')).toBeInTheDocument()
    })

    expect(screen.getByTestId('sc-img1')).toHaveAttribute('src', 'baz')
    expect(screen.queryByTestId('sc-img0')).not.toBeInTheDocument()
    expect(screen.queryByTestId('sc-img2')).not.toBeInTheDocument()
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
      expect(screen.getByTestId('sc-img0')).toBeInTheDocument()
    })

    userEvent.click(screen.getByLabelText('Next image'))

    await waitFor(() => {
      expect(screen.getByTestId('sc-img1')).toHaveAttribute('src', 'baz')
    })

    // Wraps around from the first image to the last
    userEvent.click(screen.getByLabelText('Previous image'))
    userEvent.click(screen.getByLabelText('Previous image'))

    await waitFor(() => {
      expect(screen.getByTestId('sc-img2')).toHaveAttribute('src', 'bonk')
    })
  })

  it('does not display modal when image is clicked from postCard', async () => {
    render(<CardImageAttachments
      attachments={[
        { url: 'bar', type: 'image' },
        { url: 'baz', type: 'image' },
        { url: 'bonk', type: 'image' }
      ]} className='post-card'
           />)

    userEvent.click(screen.getByAltText('Attached image 1'))

    await waitFor(() => {
      expect(screen.queryByTestId('sc-img0')).not.toBeInTheDocument()
    })
  })
})
