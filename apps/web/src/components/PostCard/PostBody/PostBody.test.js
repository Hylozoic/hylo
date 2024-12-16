import React from 'react'
import { render, screen } from 'util/testing/reactTestingLibraryExtended'
import PostBody from './index'

describe('PostBody', () => {
  const defaultProps = {
    id: 1,
    title: 'hello there',
    details: 'the details',
    linkPreview: {
      title: 'a walk in the park',
      url: 'https://www.hylo.com/awitp',
      imageUrl: 'foo.png'
    },
    slug: 'foomunity',
    expanded: true,
    className: 'classy',
    highlightProps: { term: 'foo' },
    groups: [
      {
        id: 1,
        name: 'foo',
        slug: 'foo'
      }
    ],
    fileAttachments: [
      {
        id: 1,
        url: 'https://www.hylo.com/awitp.pdf',
        type: 'file'
      },
      {
        id: 2,
        url: 'http://www.google.com/lalala.zip',
        type: 'file'
      }
    ]
  }

  const renderComponent = (props = {}) => {
    return render(
      <PostBody {...defaultProps} {...props} />
    )
  }

  it('renders the post title', () => {
    renderComponent()
    expect(screen.getByText('hello there')).toBeInTheDocument()
  })

  it('renders the post details', () => {
    renderComponent()
    expect(screen.getByText('the details')).toBeInTheDocument()
  })

  it('renders the link preview', () => {
    renderComponent()
    expect(screen.getByText('a walk in the park')).toBeInTheDocument()
  })

  it('renders file attachments', () => {
    renderComponent()
    expect(screen.getByText('awitp.pdf')).toBeInTheDocument()
    expect(screen.getByText('lalala.zip')).toBeInTheDocument()
  })

  it('applies the provided className', () => {
    const { container } = renderComponent()
    expect(container.querySelector('.classy')).toBeInTheDocument()
  })

  // Add more specific tests as needed
})
