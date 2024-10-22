import React from 'react'
import { render, screen } from 'util/testing/reactTestingLibraryExtended'
import PostDetails from './index'

describe('PostDetails', () => {
  const defaultProps = {
    id: 1,
    details: 'the details',
    linkPreview: {
      title: 'a walk in the park',
      url: 'www.hylo.com/awitp',
      imageUrl: 'foo.png'
    },
    slug: 'foomunity',
    expanded: true,
    className: 'classy',
    highlightProps: { term: 'foo' },
    fileAttachments: [
      {
        id: 1,
        url: 'https://www.hylo.com/awitp.pdf'
      },
      {
        id: 2,
        url: 'http://www.google.com/lalala.zip'
      }
    ]
  }

  it('renders post details correctly', () => {
    render(<PostDetails {...defaultProps} />)

    // Check if the details are rendered
    expect(screen.getByText('the details')).toBeInTheDocument()

    // Check if the link preview is rendered
    expect(screen.getByText('a walk in the park')).toBeInTheDocument()

    // Check if file attachments are rendered
    expect(screen.getByText('awitp.pdf')).toBeInTheDocument()
    expect(screen.getByText('lalala.zip')).toBeInTheDocument()
  })

  it('truncates details when not expanded', () => {
    const longDetails = 'a'.repeat(200)
    render(<PostDetails {...defaultProps} details={longDetails} expanded={false} />)

    // Check if the details are truncated
    expect(screen.getByText(/^a+\.{3}$/)).toBeInTheDocument()
  })

  it('renders edit timestamp when provided', () => {
    const props = {
      ...defaultProps,
      editedTimestamp: '2 hours ago',
      exactEditedTimestamp: '2023-04-01 14:30:00'
    }
    render(<PostDetails {...props} />)

    // Check if the edit timestamp is rendered
    expect(screen.getByText('2 hours ago')).toBeInTheDocument()
  })
})
