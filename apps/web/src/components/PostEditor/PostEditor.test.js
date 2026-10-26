/* eslint-env jest */
import React from 'react'
import mockGraphqlServer from 'util/testing/mockGraphqlServer'
import { graphql, HttpResponse } from 'msw'
import { render, screen, waitFor, act, AllTheProviders } from 'util/testing/reactTestingLibraryExtended'
import userEvent from '@testing-library/user-event'
import updatePost from 'store/actions/updatePost'
import orm from 'store/models'
import PostEditor from './PostEditor'
import ActionsBar from './ActionsBar'

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

jest.mock('lodash/debounce', () => fn => {
  fn.cancel = jest.fn()
  return fn
})

function testProviders ({ withLinkPreview, postType = 'discussion', title = 'Test Post', groups = [{ id: '1', name: 'Test Group' }], details, postAttrs: extraPostAttrs = {} } = {}) {
  const ormSession = orm.mutableSession(orm.getEmptyState())
  ormSession.Me.create({ id: '1' })
  ormSession.Group.create({ id: '1', name: 'Test Group', slug: 'test-group' })
  const postAttrs = { id: '1', title, type: postType, groups, topics: [{ name: 'design' }], ...(details ? { details } : {}), ...extraPostAttrs }
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
      graphql.query('FetchGroupSpaces', () => {
        return HttpResponse.json({ data: { group: { id: '1', spaces: { items: [] } } } })
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
        expect(screen.getByText('Venue')).toBeInTheDocument()
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

  describe('removing times', () => {
    const timedPost = {
      startTime: '2030-05-01T10:00:00.000Z',
      endTime: '2030-05-01T12:00:00.000Z',
      timezone: 'UTC'
    }
    const renderTimedPost = (postType, props = {}, times = timedPost) => {
      jest.spyOn(require('react-router-dom'), 'useParams').mockReturnValue({ groupSlug: 'test-group', postId: '1' })
      return renderComponent({ editing: true, ...props }, { postType, postAttrs: { ...times, groups: ['1'] } })
    }

    beforeEach(() => {
      updatePost.mockClear()
    })

    it('removing the start time removes the end time too, and saves both as null', async () => {
      const ref = React.createRef()
      renderTimedPost('request', { ref })
      const user = userEvent.setup()

      await user.click(await screen.findByTestId('post-editor-clear-start-time'))

      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
      expect(screen.getByText('Select Start')).toBeInTheDocument()
      expect(screen.getByText('Select End')).toBeInTheDocument()
      expect(screen.queryByTestId('post-editor-clear-start-time')).not.toBeInTheDocument()
      expect(screen.queryByTestId('post-editor-clear-end-time')).not.toBeInTheDocument()

      await act(async () => { ref.current.submit() })
      await waitFor(() => expect(updatePost).toHaveBeenCalled())
      expect(updatePost.mock.calls[0][0]).toMatchObject({ id: '1', startTime: null, endTime: null })
    })

    it('can remove only the end time', async () => {
      const ref = React.createRef()
      renderTimedPost('project', { ref })
      const user = userEvent.setup()

      await user.click(await screen.findByTestId('post-editor-clear-end-time'))

      expect(screen.queryByText('Select Start')).not.toBeInTheDocument()
      expect(screen.getByText('Select End')).toBeInTheDocument()
      expect(screen.getByTestId('post-editor-clear-start-time')).toBeInTheDocument()
      expect(screen.queryByTestId('post-editor-clear-end-time')).not.toBeInTheDocument()

      await act(async () => { ref.current.submit() })
      await waitFor(() => expect(updatePost).toHaveBeenCalled())
      const saved = updatePost.mock.calls[0][0]
      expect(saved.startTime.toISOString()).toEqual('2030-05-01T10:00:00.000Z')
      expect(saved.endTime).toBeNull()
    })

    describe('of a proposal', () => {
      const votingStarted = {
        startTime: '2020-05-01T10:00:00.000Z',
        endTime: '2030-05-01T12:00:00.000Z',
        timezone: 'UTC'
      }

      it('asks before removing the voting window, and Cancel keeps both times', async () => {
        renderTimedPost('proposal', {}, votingStarted)
        const user = userEvent.setup()

        await user.click(await screen.findByTestId('post-editor-clear-start-time'))

        const dialog = await screen.findByRole('dialog')
        expect(dialog).toHaveTextContent('Remove the voting window?')
        expect(dialog).toHaveTextContent('This makes it a casual proposal: there will be no voting period and no deadline.')
        await user.click(screen.getByRole('button', { name: 'Cancel' }))

        await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
        expect(screen.queryByText('Select Start')).not.toBeInTheDocument()
        expect(screen.queryByText('Select End')).not.toBeInTheDocument()
        expect(screen.getByTestId('post-editor-clear-start-time')).toBeInTheDocument()
        expect(screen.getByTestId('post-editor-clear-end-time')).toBeInTheDocument()
      })

      it('removes the voting window when confirmed', async () => {
        renderTimedPost('proposal', {}, votingStarted)
        const user = userEvent.setup()

        await user.click(await screen.findByTestId('post-editor-clear-start-time'))
        await user.click(await screen.findByTestId('post-editor-confirm-remove-voting-time'))

        await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
        expect(screen.getByText('Select Start')).toBeInTheDocument()
        expect(screen.getByText('Select End')).toBeInTheDocument()
        expect(screen.queryByTestId('post-editor-clear-start-time')).not.toBeInTheDocument()
      })

      it('says voting stays open with no deadline before removing the end of a started vote', async () => {
        renderTimedPost('proposal', {}, votingStarted)
        const user = userEvent.setup()

        await user.click(await screen.findByTestId('post-editor-clear-end-time'))

        const dialog = await screen.findByRole('dialog')
        expect(dialog).toHaveTextContent('Remove the voting end time?')
        expect(dialog).toHaveTextContent('Voting will stay open with no deadline, and the proposal will never be marked as complete.')
        await user.click(screen.getByTestId('post-editor-confirm-remove-voting-time'))

        await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
        expect(screen.getByText('Select End')).toBeInTheDocument()
        expect(screen.queryByText('Select Start')).not.toBeInTheDocument()
      })

      it('says voting will not open on its own before removing the end of a vote that has not started', async () => {
        renderTimedPost('proposal')
        const user = userEvent.setup()

        await user.click(await screen.findByTestId('post-editor-clear-end-time'))

        expect(await screen.findByRole('dialog')).toHaveTextContent('Without an end time, voting will not open on its own at the start time, and there will be no deadline.')
      })
    })

    it('does not offer to remove the times of an event, which requires them', async () => {
      renderTimedPost('event')
      await screen.findByText('Timeframe')
      expect(screen.queryByTestId('post-editor-clear-start-time')).not.toBeInTheDocument()
      expect(screen.queryByTestId('post-editor-clear-end-time')).not.toBeInTheDocument()
    })
  })

  describe('editing a chat post', () => {
    it('only shows the body and attachment controls', async () => {
      jest.spyOn(require('react-router-dom'), 'useParams').mockReturnValue({ groupSlug: 'test-group', postId: '1' })
      renderComponent({ editing: true }, { postType: 'chat', title: '' })

      await waitFor(() => {
        expect(screen.getByTestId('add-image-icon')).toBeInTheDocument()
        expect(screen.getByTestId('add-file-icon')).toBeInTheDocument()
      })
      expect(screen.queryByText('Title')).not.toBeInTheDocument()
      expect(screen.queryByText('To')).not.toBeInTheDocument()
      expect(screen.queryByText('Timeframe')).not.toBeInTheDocument()
      expect(screen.queryByText('Timezone')).not.toBeInTheDocument()
      expect(screen.queryByText(/Make Public/)).not.toBeInTheDocument()
      expect(screen.queryByTestId('announcement-icon')).not.toBeInTheDocument()
      expect(screen.queryByRole('combobox')).not.toBeInTheDocument()
      expect(screen.getByText('Editing Chat')).toBeInTheDocument()
    })

    // The chat room loads posts without their groups; the route's group stands in so the edit can be saved
    it('uses the route group when the stored chat post has no groups', async () => {
      jest.spyOn(require('react-router-dom'), 'useParams').mockReturnValue({ groupSlug: 'test-group', postId: '1' })
      renderComponent({ editing: true }, { postType: 'chat', title: '', groups: [], details: '<p>hello chat</p>' })

      const submit = await screen.findByTestId('post-editor-submit')
      await waitFor(() => expect(screen.getByText('Editing Chat')).toBeInTheDocument())
      expect(submit).not.toHaveAttribute('data-tooltip-html', expect.stringContaining('At least one group required'))
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
