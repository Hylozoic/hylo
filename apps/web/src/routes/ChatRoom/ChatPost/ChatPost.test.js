import React from 'react'
import { fireEvent, render, screen, AllTheProviders } from 'util/testing/reactTestingLibraryExtended'
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
      creator: { id: '1', name: 'John Doe' },
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
        imageUrl: 'foo.png'
      },
      attachments: [
        {
          id: 1,
          type: 'image',
          url: 'https://www.hylo.com/awitp.gif'
        },
        {
          id: 2,
          type: 'image',
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

  it('clips details from first paint so Virtuoso can measure a stable height', () => {
    renderComponent({
      post: {
        ...defaultProps.post,
        details: '<p>a long chat post</p>'.repeat(20)
      }
    })
    const details = screen.getByTestId('chat-post-details')
    expect(details).toHaveStyle({ maxHeight: '200px', overflow: 'hidden' })
  })

  it('does not crash when a hover action that expects the click event is used', () => {
    const confirmSpy = jest.spyOn(window, 'confirm').mockReturnValue(false)
    renderComponent()

    fireEvent.click(document.querySelector('[data-tooltip-content="Delete post"]'))
    expect(confirmSpy).toHaveBeenCalled()
    confirmSpy.mockRestore()
  })
})
