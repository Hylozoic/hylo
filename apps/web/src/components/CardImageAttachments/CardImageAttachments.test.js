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

    await waitFor(() => {
      expect(screen.getAllByTestId('sc-img0')).toHaveLength(2)
      expect(screen.getAllByTestId('sc-img1')).toHaveLength(2)
      expect(screen.getAllByTestId('sc-img2')).toHaveLength(3)
    })

    const activeSlide = screen.getAllByTestId('sc-img1')[0].closest('[aria-hidden]')
    expect(activeSlide).toHaveAttribute('aria-hidden', 'false')

    const inactiveSlides = screen.getAllByTestId(/sc-img[02]/).map(img => img.closest('[aria-hidden]'))
    inactiveSlides.forEach(slide => {
      expect(slide).toHaveAttribute('aria-hidden', 'true')
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
