/* eslint-env jest */
import React from 'react'
import mockGraphqlServer from 'util/testing/mockGraphqlServer'
import { graphql, HttpResponse } from 'msw'
import { render, screen, waitFor, AllTheProviders } from 'util/testing/reactTestingLibraryExtended'
import orm from 'store/models'

jest.mock('store/actions/createPost', () => {
  return jest.fn(() => {
    return {
      type: 'CREATE_POST_SUCCESS',
      payload: {}
    }
  })
})
jest.mock('store/actions/updatePost', () => {
  return jest.fn(() => {
    return {
      type: 'UPDATE_POST_SUCCESS',
      payload: {}
    }
  })
})

import PostEditor from './PostEditor'
import ActionsBar from './ActionsBar'

jest.mock('lodash/debounce', () => fn => {
  fn.cancel = jest.fn()
  return fn
})

function testProviders ({ withLinkPreview } = {}) {
  const ormSession = orm.mutableSession(orm.getEmptyState())
  ormSession.Me.create({ id: '1' })
  ormSession.Group.create({ id: '1', name: 'Test Group', slug: 'test-group' })
  const postAttrs = { id: '1', title: 'Test Post', type: 'discussion', groups: [{ id: '1', name: 'Test Group' }], topics: [{ name: 'design' }] }
  if (withLinkPreview) {
    ormSession.LinkPreview.create({
      id: 'lp1',
      title: 'Example Site',
      description: 'A description',
      url: 'https://example.com',
      imageUrl: 'https://example.com/img.png'
    })
    postAttrs.linkPreview = 'lp1'
    postAttrs.linkPreviewFeatured = false
  }
  ormSession.Post.create(postAttrs)
  const reduxState = { orm: ormSession.state }

  return AllTheProviders(reduxState)
}

describe('PostEditor', () => {
  beforeEach(() => {
    mockGraphqlServer.use(
      graphql.query('FetchPost', () => {
        return HttpResponse.json({
          data: {
            post: null
          }
        })
      }),
      graphql.query('FetchTopics', () => {
        return HttpResponse.json({
          data: {
            topics: []
          }
        })
      }),
      graphql.query('FetchGroupChatRooms', () => {
        return HttpResponse.json({ data: { me: { memberships: [] } } })
      }),
      graphql.query('FetchAllMyGroupsSpaces', () => {
        return HttpResponse.json({ data: { me: { memberships: [] } } })
      }),
      graphql.mutation('CreatePost', () => {
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

  const renderComponent = (props = {}, providerOptions) => {
    return render(
      <PostEditor {...baseProps} {...props} />,
      { wrapper: testProviders(providerOptions) }
    )
  }

  it('renders with min props', async () => {
    renderComponent()

    await waitFor(() => {
      expect(screen.getByText('Title')).toBeInTheDocument()
    })
  })

  describe('for a new post', () => {
    it('renders title field and description editor', async () => {
      const { container } = renderComponent({ initialPrompt: 'a test prompt' })
      await waitFor(() => {
        expect(screen.getByText('Title')).toBeInTheDocument()
        expect(container.querySelector('.hyloEditor')).toBeInTheDocument()
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

    it('shows the existing link preview', async () => {
      jest.spyOn(require('react-router-dom'), 'useParams').mockReturnValue({ groupSlug: 'test-group', postId: '1' })
      renderComponent(editProps, { withLinkPreview: true })
      await waitFor(() => {
        expect(screen.getByText('Example Site')).toBeInTheDocument()
        expect(screen.getByText('example.com')).toBeInTheDocument()
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
    doSave: jest.fn(),
    setAnnouncementSelected: jest.fn(),
    setIsDirty: jest.fn(),
    announcementSelected: false,
    toggleAnnouncementModal: jest.fn(),
    showAnnouncementModal: false,
    groupCount: 1,
    canMakeAnnouncement: true,
    myAdminGroups: [],
    groups: [],
    invalidMessage: 'Invalid post'
  }

  it('renders correctly', async () => {
    render(<ActionsBar {...baseProps} />)
    await waitFor(() => {
      expect(screen.getByTestId('add-image-icon')).toBeInTheDocument()
      expect(screen.getByTestId('add-file-icon')).toBeInTheDocument()
    })
  })

  it('disables post button when invalid', async () => {
    render(<ActionsBar {...baseProps} valid={false} />)
    await waitFor(() => {
      const buttons = screen.getAllByRole('button')
      const submitButton = buttons.find(button => button.querySelector('svg'))
      expect(submitButton).toHaveClass('disabled')
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
