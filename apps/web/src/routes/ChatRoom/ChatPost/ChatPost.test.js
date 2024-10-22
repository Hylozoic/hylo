import React from 'react'
import { Provider } from 'react-redux'
import { createStore } from 'redux'
import { render, screen } from 'util/testing/reactTestingLibraryExtended'
import ChatPost from './index'

describe('ChatPost', () => {
  const defaultProps = {
    id: 1,
    commenters: [],
    commentsTotal: 0,
    createdAt: '2024-01-01',
    creator: { id: 1, name: 'John Doe' },
    editedAt: '2024-02-01',
    details: 'the details',
    groups: [],
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
    ],
    imageAttachments: [],
    linkPreviewFeatured: null,
    myReactions: [],
    postReactions: []
  }

  const renderComponent = (props = {}) => {
    const mergedProps = { ...defaultProps, ...props }
    return render(
      <Provider store={createStore(() => ({}))}>
        <ChatPost {...mergedProps} />
      </Provider>
    )
  }

  it('renders post details', () => {
    renderComponent()
    expect(screen.getByText('the details')).toBeInTheDocument()
  })

  it('renders link preview', () => {
    renderComponent()
    expect(screen.getByText('a walk in the park')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'a walk in the park' })).toHaveAttribute('href', 'www.hylo.com/awitp')
  })

  it('renders file attachments', () => {
    renderComponent()
    expect(screen.getByText('awitp.pdf')).toBeInTheDocument()
    expect(screen.getByText('lalala.zip')).toBeInTheDocument()
  })

  // Add more tests as needed
})
