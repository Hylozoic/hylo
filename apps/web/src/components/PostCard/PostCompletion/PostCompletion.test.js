import React from 'react'
import { graphql, HttpResponse } from 'msw'
import { fireEvent, render, screen, waitFor } from 'util/testing/reactTestingLibraryExtended'
import mockGraphqlServer from 'util/testing/mockGraphqlServer'
import PostCompletion from './PostCompletion'

const mockNavigate = jest.fn()
let mockSearch = ''

jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useLocation: () => ({ pathname: '/groups/garden/post/91', search: mockSearch }),
  useNavigate: () => mockNavigate
}))

const commenters = [
  { id: '2', name: 'Sam Helper', avatarUrl: null },
  { id: '3', name: 'Kim Neighbor', avatarUrl: null }
]

// Answers the commenters query and records the helpers the dialog sends
function mockHelperQueries ({ people = commenters, saveFails = false } = {}) {
  const saved = []
  mockGraphqlServer.use(
    graphql.query('PostHelperCandidates', () => HttpResponse.json({ data: { post: { id: '91', commenters: people } } })),
    graphql.mutation('AddRequestHelpers', ({ variables }) => {
      saved.push(variables)
      return saveFails
        ? HttpResponse.json({ errors: [{ message: 'Helpers must be people who commented on this request' }] })
        : HttpResponse.json({ data: { fulfillPost: { success: true } } })
    })
  )
  return saved
}

describe('PostCompletion', () => {
  afterEach(() => {
    mockSearch = ''
    mockNavigate.mockClear()
  })

  it('renders correctly if fulfilled for a project', () => {
    render(<PostCompletion isFulfilled type='project' />)

    expect(screen.getByText('Is this project still active?')).toBeInTheDocument()
    expect(screen.getByText('YES')).toBeInTheDocument()
    expect(screen.getByText('NO')).toBeInTheDocument()
  })

  it('renders correctly if not fulfilled for a resource', () => {
    render(<PostCompletion isFulfilled={false} type='resource' />)

    expect(screen.getByText('Is this resource still available?')).toBeInTheDocument()
    expect(screen.getByRole('switch')).toHaveAttribute('aria-checked', 'true')
  })

  it('renders moderator styling when isModerator is true', () => {
    render(<PostCompletion isFulfilled={false} type='request' isModerator />)

    expect(screen.getByText('Moderator')).toBeInTheDocument()
    expect(screen.getByText('Is this request still needed?')).toBeInTheDocument()
  })

  describe('Who helped? (D27)', () => {
    it('marks the request met, then offers the commenters and thanks the ones picked', async () => {
      const saved = mockHelperQueries()
      const fulfillPost = jest.fn()
      render(<PostCompletion postId='91' isFulfilled={false} type='request' fulfillPost={fulfillPost} unfulfillPost={jest.fn()} />)

      fireEvent.click(screen.getByRole('switch'))
      expect(fulfillPost).toHaveBeenCalledTimes(1)

      expect(await screen.findByTestId('who-helped-dialog')).toBeInTheDocument()
      expect(screen.getByText('Who helped?')).toBeInTheDocument()
      expect(screen.getByText('Sam Helper')).toBeInTheDocument()
      expect(screen.getByText('Kim Neighbor')).toBeInTheDocument()
      expect(screen.getByTestId('who-helped-save')).toBeDisabled()

      fireEvent.click(screen.getByRole('checkbox', { name: 'Sam Helper' }))
      fireEvent.click(screen.getByTestId('who-helped-save'))

      await waitFor(() => expect(screen.queryByTestId('who-helped-dialog')).not.toBeInTheDocument())
      expect(saved).toEqual([{ postId: '91', contributorIds: ['2'] }])
    })

    it('can be skipped', async () => {
      const saved = mockHelperQueries()
      render(<PostCompletion postId='91' isFulfilled={false} type='request' fulfillPost={jest.fn()} unfulfillPost={jest.fn()} />)

      fireEvent.click(screen.getByRole('switch'))
      await screen.findByTestId('who-helped-dialog')
      fireEvent.click(screen.getByTestId('who-helped-skip'))

      await waitFor(() => expect(screen.queryByTestId('who-helped-dialog')).not.toBeInTheDocument())
      expect(saved).toEqual([])
    })

    it('says so when saving fails, and stays open', async () => {
      mockHelperQueries({ saveFails: true })
      render(<PostCompletion postId='91' isFulfilled={false} type='request' fulfillPost={jest.fn()} unfulfillPost={jest.fn()} />)

      fireEvent.click(screen.getByRole('switch'))
      await screen.findByTestId('who-helped-dialog')
      fireEvent.click(screen.getByRole('checkbox', { name: 'Kim Neighbor' }))
      fireEvent.click(screen.getByTestId('who-helped-save'))

      expect(await screen.findByText('There was an error, please try again.')).toBeInTheDocument()
      expect(screen.getByTestId('who-helped-dialog')).toBeInTheDocument()
    })

    it('does not ask when nobody else commented', async () => {
      mockHelperQueries({ people: [] })
      const fulfillPost = jest.fn()
      render(<PostCompletion postId='91' isFulfilled={false} type='request' fulfillPost={fulfillPost} unfulfillPost={jest.fn()} />)

      fireEvent.click(screen.getByRole('switch'))
      expect(fulfillPost).toHaveBeenCalled()
      await new Promise(resolve => setTimeout(resolve, 50))
      expect(screen.queryByTestId('who-helped-dialog')).not.toBeInTheDocument()
    })

    it('does not ask about offers, or when a moderator marks a request met', async () => {
      mockHelperQueries()
      const { unmount } = render(<PostCompletion postId='91' isFulfilled={false} type='offer' fulfillPost={jest.fn()} unfulfillPost={jest.fn()} />)
      fireEvent.click(screen.getByRole('switch'))
      await new Promise(resolve => setTimeout(resolve, 50))
      expect(screen.queryByTestId('who-helped-dialog')).not.toBeInTheDocument()
      unmount()

      render(<PostCompletion postId='91' isFulfilled={false} type='request' isModerator fulfillPost={jest.fn()} unfulfillPost={jest.fn()} />)
      fireEvent.click(screen.getByRole('switch'))
      await new Promise(resolve => setTimeout(resolve, 50))
      expect(screen.queryByTestId('who-helped-dialog')).not.toBeInTheDocument()
    })

    it('marks the request met from ?action=met once, drops the param and asks who helped', async () => {
      mockHelperQueries()
      mockSearch = '?action=met&ctt=open_request_nudge'
      const fulfillPost = jest.fn()
      render(<PostCompletion postId='91' isFulfilled={false} type='request' fulfillPost={fulfillPost} unfulfillPost={jest.fn()} />)

      expect(await screen.findByTestId('who-helped-dialog')).toBeInTheDocument()
      expect(fulfillPost).toHaveBeenCalledTimes(1)
      expect(mockNavigate).toHaveBeenCalledWith(
        { pathname: '/groups/garden/post/91', search: '?ctt=open_request_nudge' },
        { replace: true, state: undefined }
      )
    })

    it('does not mark an already met request again from ?action=met', async () => {
      mockHelperQueries()
      mockSearch = '?action=met'
      const fulfillPost = jest.fn()
      render(<PostCompletion postId='91' isFulfilled type='request' fulfillPost={fulfillPost} unfulfillPost={jest.fn()} />)

      expect(await screen.findByTestId('who-helped-dialog')).toBeInTheDocument()
      expect(fulfillPost).not.toHaveBeenCalled()
    })
  })
})
