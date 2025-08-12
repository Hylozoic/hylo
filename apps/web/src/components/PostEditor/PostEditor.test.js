/* eslint-env jest */
import React, { act } from 'react'
import mockGraphqlServer from 'util/testing/mockGraphqlServer'
import { graphql, HttpResponse } from 'msw'
import { render, screen, fireEvent, waitFor, AllTheProviders } from 'util/testing/reactTestingLibraryExtended'
import orm from 'store/models'

jest.mock('store/actions/createPost', () => {
  return jest.fn(() => {
    return {
      type: 'CREATE_POST_SUCCESS',
      payload: { /* mock payload data */ }
    };
  });
});
jest.mock('store/actions/updatePost', () => {
  return jest.fn(() => {
    return {
      type: 'UPDATE_POST_SUCCESS',
      payload: { /* mock payload data */ }
    };
  });
});
import createPost from 'store/actions/createPost'
import updatePost from 'store/actions/updatePost'

import PostEditor from './PostEditor'
import ActionsBar from './ActionsBar'
import { editPostUrl } from '@hylo/navigation'

jest.mock('lodash/debounce', () => fn => {
  fn.cancel = jest.fn()
  return fn
})

function testProviders () {
  const ormSession = orm.mutableSession(orm.getEmptyState())
  ormSession.Group.create({ id: '1', name: 'Test Group', slug: 'test-group' })
  ormSession.Post.create({ id: '1', title: 'Test Post', type: 'discussion', groups: [{ id: '1', name: 'Test Group' }], topics: [{ name: 'design' }] })
  const reduxState = { orm: ormSession.state }

  return AllTheProviders(reduxState)
}

describe('PostEditor', () => {
  beforeEach(() => {
    mockGraphqlServer.use(
      graphql.query('FetchPost', ({ query, variables }) => {
        return HttpResponse.json({
          data: {
            post: null
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
            post: {
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

  const baseProps = {
    currentUser: { id: '1', avatarUrl: 'https://example.com/avatar.jpg' },
    groupOptions: [{ id: '1', name: 'Test Group' }],
    myAdminGroups: [],
    context: 'group',
    onClose: jest.fn()
  }

  const renderComponent = (props = {}) => {
    return render(
      <PostEditor {...baseProps} {...props} />,
      { wrapper: testProviders() }
    )
  }

  it('renders with min props', async () => {
    renderComponent()

    await waitFor(() => {
      expect(screen.getByPlaceholderText('Add a title')).toBeInTheDocument()
    })
  })

  describe('for a new post', () => {
    it('renders initial prompt and placeholders', async () => {
      renderComponent({ initialPrompt: 'a test prompt' })
      await waitFor(() => {
        expect(screen.getByPlaceholderText('Add a title')).toBeInTheDocument()
      })
    })

    it('renders correct title placeholder for different post types', async () => {
      const postTypes = ['discussion', 'request', 'offer', 'resource']
      postTypes.forEach(type => {
        renderComponent({ post: { type } })
      })
      await waitFor(() => {
        expect(screen.getAllByPlaceholderText('Add a title')).toHaveLength(postTypes.length)
      })
    })

    it('calls createPost when saving a new post', async () => {
      jest.spyOn(require('react-router-dom'), 'useParams').mockReturnValue({ groupSlug: 'test-group' })

      renderComponent({
        fetchLocation: jest.fn().mockReturnValue('8778'),
        ensureLocationIdIfCoordinate: jest.fn().mockResolvedValue('666'),
      })

      await waitFor(async () => {
        const titleInput = screen.getByPlaceholderText('Add a title')
        fireEvent.change(titleInput, { target: { value: 'Test Title' } })
      })

      // Post button to be enabled
      await waitFor(() => {
        expect(screen.getByText('Post')).toBeEnabled()
      })

      fireEvent.click(screen.getByText('Post'))

      await waitFor(() => {
        expect(createPost).toHaveBeenCalled()
      })
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
      editPostId: '1',
      post: {
        id: '1',
        type: 'request',
        title: 'Test Title',
        groups: [{ id: '1', name: 'Test Group', slug: 'test-group' }],
        topics: [{ name: 'design' }]
      },
      showImagePreviews: true,
      ensureLocationIdIfCoordinate: jest.fn().mockResolvedValue('555'),
      setIsDirty: jest.fn()
    }

    it('loads post data into fields', async () => {
      jest.spyOn(require('react-router-dom'), 'useParams').mockReturnValue({ groupSlug: 'test-group', postId: '1' })
      renderComponent(editProps)
      await waitFor(() => {
        expect(screen.getByDisplayValue('Test Post')).toBeInTheDocument()
      })
    })

    it('calls updatePost when saving an edited post', async () => {
      jest.spyOn(require('react-router-dom'), 'useParams').mockReturnValue({ groupSlug: 'test-group', postId: '1' })
      renderComponent(editProps)
      await waitFor(() => {
        expect(screen.getByDisplayValue('Test Post')).toBeInTheDocument()
      })
      await waitFor(() => {
        fireEvent.click(screen.getByText('Save'))
      })

      await waitFor(() => {
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
      expect(screen.getByText('Post')).toBeInTheDocument()
      expect(screen.getByTestId('add-image-icon')).toBeInTheDocument()
      expect(screen.getByTestId('add-file-icon')).toBeInTheDocument()
    })
  })

  it('disables post button when invalid', async () => {
    render(<ActionsBar {...baseProps} valid={false} />)
    await waitFor(() => {
      expect(screen.getByText('Post')).toHaveClass('disabled')
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
