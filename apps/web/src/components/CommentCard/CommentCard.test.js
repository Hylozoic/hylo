import React from 'react'
import { render, screen, waitFor } from 'util/testing/reactTestingLibraryExtended'
import CommentCard from './CommentCard'

const mockShowDetails = jest.fn()

const defaultProps = {
  comment: {
    text: '<p>text of the comment. a long one. text of the comment. a long one. text of the comment. a long one. text of the comment. a long one. text of the comment. a long one. text of the comment. a long one.</p>',
    creator: {
      id: 1,
      name: 'Joe Smith',
      avatarUrl: 'foo.jpg'
    },
    attachments: [],
    post: {
      id: 77,
      title: 'Awesome Sauce #hashtag'
    },
    createdAt: new Date('2023-04-01T12:00:00Z')
  },
  expanded: false,
  highlightProps: { term: 'foo' },
  showDetails: mockShowDetails
}

describe('CommentCard', () => {
  it('renders comment card with correct content', () => {
    render(<CommentCard {...defaultProps} />)

    expect(screen.getByText('Joe Smith')).toBeInTheDocument()
    expect(screen.getByText('commented on')).toBeInTheDocument()
    expect(screen.getByText('Awesome Sauce #hashtag')).toBeInTheDocument()
    expect(screen.getByText(/text of the comment/)).toBeInTheDocument()
    expect(screen.getByText('Commented 1 year ago')).toBeInTheDocument()
  })

  it('renders expanded comment', () => {
    render(<CommentCard {...defaultProps} expanded />)

    const commentText = screen.getByText(/text of the comment/)
    expect(commentText.textContent).toEqual(defaultProps.comment.text.replace(/<\/?p>/g, ''))
  })

  it('renders truncated comment when not expanded', () => {
    render(<CommentCard {...defaultProps} expanded={false} />)

    const commentText = screen.getByText(/text of the comment/)
    expect(commentText.textContent.length).toBeLessThanOrEqual(145)
  })

  it('displays image attachments', async () => {
    const propsWithImage = {
      ...defaultProps,
      comment: {
        ...defaultProps.comment,
        attachments: [
          { url: 'jam.png', type: 'image' }
        ]
      }
    }

    render(<CommentCard {...propsWithImage} />)

    await waitFor(() => {
      expect(screen.getByTestId('first-image').getAttribute('src')).toEqual('jam.png')
    })
  })

  it('calls showDetails when clicked', () => {
    render(<CommentCard {...defaultProps} />)

    screen.getByText('Joe Smith').click()
    expect(mockShowDetails).toHaveBeenCalledWith(defaultProps.comment.post.id)
  })
})
