/* eslint-env jest */
import React, { act } from 'react'
import orm from 'store/models'
import mockGraphqlServer from 'util/testing/mockGraphqlServer'
import { graphql, HttpResponse } from 'msw'
import { render, screen, fireEvent, waitFor, AllTheProviders } from 'util/testing/reactTestingLibraryExtended'
import PostEditor from './PostEditor'
import ActionsBar from './ActionsBar'
import { editPostUrl } from '@hylo/navigation'
import * as reactRedux from 'react-redux'
import getGroupForSlug from 'store/selectors/getGroupForSlug'
import presentPost from 'store/presenters/presentPost'

jest.mock('store/actions/createPost', () => {
  return jest.fn(() => {
    return {
      type: 'CREATE_POST_SUCCESS',
      payload: { /* mock payload data */ }
    }
  })
})
import createPost from 'store/actions/createPost'

jest.mock('store/actions/updatePost', () => {
  return jest.fn(() => {
    return {
      type: 'UPDATE_POST_SUCCESS',
      payload: { /* mock payload data */ }
    }
  })
})
import updatePost from 'store/actions/updatePost'

jest.mock('store/selectors/getGroupForSlug', () => {
  return jest.fn().mockReturnValue({ id: '1', name: 'Test Group', slug: 'test-group' })
})

jest.mock('store/presenters/presentPost', () => {
  return jest.fn(() => {
    return {
      id: '1',
      type: 'request',
      title: 'Test Post'
    }
  })
})

jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useParams: jest.fn().mockReturnValue({ context: 'groups', groupSlug: 'test-group' }),
  useLocation: jest.fn().mockReturnValue({ pathname: '/groups/test-group', search: '' })
}))

jest.mock('lodash/debounce', () => fn => {
  fn.cancel = jest.fn()
  return fn
})

const testGroup = {
  id: '1',
  name: 'Test Group',
  slug: 'test-group'
}

function testProviders () {
  const ormSession = orm.mutableSession(orm.getEmptyState())
  ormSession.Me.create({
    id: '20',
    memberships: [ormSession.Membership.create({
      id: '345',
      group: '1'
    })]
  })
  ormSession.Group.create(testGroup)
  ormSession.Post.create({
    id: '1',
    title: 'Test Post',
    type: 'discussion',
    groups: [{ id: '1', name: 'Test Group' }],
    topics: [{ name: 'design' }],
    creator: { id: '20' }
  })
  const reduxState = { orm: ormSession.state }
  return AllTheProviders(reduxState)
}

beforeEach(() => {
  mockGraphqlServer.use(
    // Log all GraphQL operations
    graphql.operation(({ query, variables }) => {
      // console.log('GraphQL Operation:', { query, variables })
      return HttpResponse.json({ data: {} })
    }),
    graphql.query('FetchPost', ({ query, variables }) => {
      return HttpResponse.json({
        data: {
          post: {
            id: '1',
            title: 'Test Post',
            type: 'discussion',
            groups: [{ id: '1', name: 'Test Group' }],
            topics: [{ name: 'design' }]
          }
        }
      })
    }),
    graphql.query('FetchTopics', ({ query, variables }) => {
      return HttpResponse.json({
        data: {
          topics: []
        }
      })
    }),
    graphql.mutation('CreatePost', ({ query, variables }) => {
      return HttpResponse.json({
        data: {
          createPost: {
            id: '1',
            title: 'Test Post',
            groups: [{ id: '1', name: 'Test Group' }],
            topics: [{ name: 'design' }]
          }
        }
      })
    })
  )
})

const renderComponent = (props = {}) => {
  return render(
    <PostEditor {...props} />,
    { wrapper: testProviders() }
  )
}

describe('PostEditor', () => {

  it('renders with min props', async () => {
    renderComponent()

    await waitFor(() => {
      expect(screen.getByLabelText(/title/i, { selector: 'input' })).toBeInTheDocument()
    })
    expect(screen.getByLabelText(/title/i, { })).toBeInTheDocument()
  })

  test.each(['discussion', 'request', 'offer', 'resource'])(
    'renders correct title input for post type %s',
    async (type) => {
      renderComponent({ post: { type } })
      await waitFor(() => {
        expect(screen.getByLabelText(/title/i, { })).toBeInTheDocument()
      })
    }
  )

  it('calls createPost when saving a new post', async () => {
    jest.spyOn(require('react-router-dom'), 'useParams').mockReturnValue({ groupSlug: 'test-group' })

    renderComponent()

    const titleInput = await screen.findByLabelText(/title/i, { })
    fireEvent.change(titleInput, { target: { value: 'Test Title' } })
    fireEvent.click(screen.getByLabelText(/submit/i))

    await waitFor(() => {
      expect(createPost).toHaveBeenCalled()
    })
  })

  describe('for a new event', () => {
    it('renders correctly', async () => {
      renderComponent({ post: { type: 'event', groups: [] } })

      await waitFor(() => {
        expect(screen.getByText('Timeframe')).toBeInTheDocument()
        expect(screen.getByText('Location')).toBeInTheDocument()
      })
    })
  })

  describe('editing a post', () => {
    const editProps = {
      editing: true,
      post: {
        id: '1',
        type: 'request',
        title: 'Test Post'
      },
      setIsDirty: jest.fn()
    }

    it('calls updatePost when saving an edited post', async () => {
      jest.clearAllMocks()
      jest.spyOn(require('react-router-dom'), 'useParams').mockReturnValue({ groupSlug: 'test-group', postId: '1' })
      renderComponent(editProps)

      const titleInput = await screen.findByLabelText(/title/i)
      expect(titleInput.value).toEqual('Test Post')
      fireEvent.change(titleInput, { target: { value: 'New Title' } })
      expect(titleInput.value).toEqual('New Title')

      const submitButton = await screen.findByRole('button', { name: /submit/i })
      expect(submitButton).toBeEnabled()
      fireEvent.click(submitButton)

      await waitFor(() => {
        expect(createPost).not.toHaveBeenCalled()
        expect(updatePost).toHaveBeenCalled()
      })
    })

    it('tracks dirty state when content changes', async () => {
      renderComponent(editProps)
      await waitFor(() => {
        expect(screen.getByDisplayValue('Test Post')).toBeInTheDocument()
      })
      fireEvent.change(screen.getByDisplayValue('Test Post'), { target: { value: 'New Title' } })
      await waitFor(() => {
        expect(editProps.setIsDirty).toHaveBeenCalled()
      })
    })

    it('shows error for invalid title length', async () => {
      renderComponent(editProps)
      await waitFor(() => {
        expect(screen.getByDisplayValue('Test Post')).toBeInTheDocument()
      })
      await waitFor(() => {
        fireEvent.change(screen.getByDisplayValue('Test Post'), { target: { value: 'x'.repeat(81) } })
      })
      await waitFor(() => {
        expect(screen.getByText('Title limited to 80 characters')).toBeInTheDocument()
      })
    })
  })
})

describe('ActionsBar', () => {
  const baseProps = {
    id: '1',
    addAttachment: jest.fn(),
    showImages: false,
    showFiles: false,
    valid: true,
    loading: false,
    submitButtonLabel: 'Post',
    save: jest.fn(),
    setAnnouncementSelected: jest.fn(),
    announcementSelected: false,
    toggleAnnouncementModal: jest.fn(),
    showAnnouncementModal: false,
    groupCount: 1,
    canMakeAnnouncement: true,
    myAdminGroups: [],
    groups: [],
    invalidPostWarning: 'Invalid post',
    t: jest.fn(str => str)
  }

  it('renders correctly', async () => {
    render(<ActionsBar {...baseProps} />)
    await waitFor(() => {
      expect(screen.getByRole('button')).toBeInTheDocument()
      expect(screen.getByTestId('add-image-icon')).toBeInTheDocument()
      expect(screen.getByTestId('add-file-icon')).toBeInTheDocument()
    })
  })

  it('disables post button when invalid', async () => {
    render(<ActionsBar {...baseProps} valid={false} />)
    await waitFor(() => {
      expect(screen.getByRole('button')).toHaveClass('disabled')
    })
  })

  it('shows announcement icon when user can make announcements', async () => {
    render(<ActionsBar {...baseProps} canMakeAnnouncement />)
    await waitFor(() => {
      expect(screen.getByTestId('announcement-icon')).toBeInTheDocument()
    })
  })

  it('does not show announcement icon when user cannot make announcements', async () => {
    render(<ActionsBar {...baseProps} canMakeAnnouncement={false} />)
    await waitFor(() => {
      expect(screen.queryByTestId('announcement-icon')).not.toBeInTheDocument()
    })
  })
})
