import React from 'react'
import { fireEvent, render, screen, AllTheProviders } from 'util/testing/reactTestingLibraryExtended'
import orm from 'store/models'
import ChatPost from './index'

const mockViewPostDetails = jest.fn()
jest.mock('hooks/useViewPostDetails', () => () => mockViewPostDetails)

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

  it('shows the full message when it only slightly exceeds the collapsed height', () => {
    const heightSpy = jest.spyOn(window.HTMLElement.prototype, 'offsetHeight', 'get').mockReturnValue(220)
    renderComponent({
      post: {
        ...defaultProps.post,
        details: '<p>a message that ends with a full sentence.</p>'
      }
    })
    const details = screen.getByTestId('chat-post-details')
    expect(details.style.maxHeight).toBe('')
    expect(details.style.overflow).toBe('')
    expect(screen.queryByRole('button', { name: 'See More' })).not.toBeInTheDocument()
    heightSpy.mockRestore()
  })

  it('collapses a message tall enough to need See More, and expands it again', () => {
    const heightSpy = jest.spyOn(window.HTMLElement.prototype, 'offsetHeight', 'get').mockReturnValue(400)
    renderComponent({
      post: {
        ...defaultProps.post,
        details: '<p>a long chat post</p>'.repeat(20)
      }
    })
    const details = screen.getByTestId('chat-post-details')
    expect(details).toHaveStyle({ maxHeight: '200px', overflow: 'hidden' })
    fireEvent.click(screen.getByRole('button', { name: 'See More' }))
    expect(details.style.maxHeight).toBe('')
    expect(screen.getByRole('button', { name: 'See Less' })).toBeInTheDocument()
    heightSpy.mockRestore()
  })

  describe('clicking the post', () => {
    beforeEach(() => mockViewPostDetails.mockClear())

    it('opens the post when the click lands on an SVG inside it', () => {
      renderComponent({
        post: {
          ...defaultProps.post,
          details: '<p>chat with an icon <svg data-testid="inline-svg"><path d="M0 0h1v1z"></path></svg></p>'
        }
      })
      const path = screen.getByTestId('inline-svg').querySelector('path')
      expect(() => fireEvent.click(path)).not.toThrow()
      expect(mockViewPostDetails).toHaveBeenCalled()
    })

    it('does not open the post when the click lands inside an .image or .icon-Smiley element', () => {
      renderComponent({
        post: {
          ...defaultProps.post,
          details: '<p>an image <span class="image"><svg data-testid="image-svg"></svg></span><span class="icon-Smiley" data-testid="smiley"></span></p>'
        }
      })
      fireEvent.click(screen.getByTestId('image-svg'))
      fireEvent.click(screen.getByTestId('smiley'))
      expect(mockViewPostDetails).not.toHaveBeenCalled()
    })
  })

  it('does not crash when a hover action that expects the click event is used', () => {
    const confirmSpy = jest.spyOn(window, 'confirm').mockReturnValue(false)
    renderComponent()

    fireEvent.click(document.querySelector('[data-tooltip-content="Delete post"]'))
    expect(confirmSpy).toHaveBeenCalled()
    confirmSpy.mockRestore()
  })
})
