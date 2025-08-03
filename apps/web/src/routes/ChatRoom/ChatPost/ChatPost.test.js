import React from 'react'
import { render, screen, AllTheProviders } from 'util/testing/reactTestingLibraryExtended'
import orm from 'store/models'
import ChatPost from './index'

function testProviders () {
  const ormSession = orm.mutableSession(orm.getEmptyState())
  ormSession.Me.create({ id: '1' })

  const reduxState = { orm: ormSession.state, pending: {} }

  return AllTheProviders(reduxState)
}

describe('ChatPost', () => {
  const defaultProps = {
    post: {
      id: 1,
      commenters: [],
      commentsTotal: 0,
      createdAt: '2024-01-01',
      creator: { id: 1, name: 'John Doe' },
      editedAt: '2024-02-01',
      details: 'the details',
      groups: [{
        id: 1,
        name: 'foo',
        slug: 'foomunity'
      }],
      linkPreview: {
        title: 'a walk in the park',
        url: 'https://www.hylo.com/awitp',
        imageUrl: 'foo.png',
      },
      imageAttachments: [
        {
          id: 1,
          url: 'https://www.hylo.com/awitp.gif'
        },
        {
          id: 2,
          url: 'http://www.google.com/lalala.png'
        }
      ],
      fileAttachments: [],
      linkPreviewFeatured: null,
      postReactions: []
    },
    group: {
      id: 1,
      name: 'foo',
      slug: 'foomunity'
    },
    className: 'classy',
    highlightProps: { term: 'foo' }
  }

  const renderComponent = (props = {}) => {
    const mergedProps = { ...defaultProps, ...props }
    return render(
      <ChatPost {...mergedProps} />,
      { wrapper: testProviders() }
    )
  }

  it('renders post details', () => {
    renderComponent()
    expect(screen.getByText('the details')).toBeInTheDocument()
  })

  it('renders link preview', () => {
    renderComponent()
    expect(screen.getByRole('link', { name: 'a walk in the park' })).toBeInTheDocument()
  })

  it('renders image attachments', () => {
    renderComponent()
    expect(screen.getByRole('img', { name: 'https://www.hylo.com/awitp.gif' })).toBeInTheDocument()
    expect(screen.getByRole('img', { name: 'http://www.google.com/lalala.png' })).toBeInTheDocument()
  })

  // Add more tests as needed
})
