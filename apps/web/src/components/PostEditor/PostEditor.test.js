/* eslint-env jest */
import React from 'react'
import mockGraphqlServer from 'util/testing/mockGraphqlServer'
import { graphql, HttpResponse } from 'msw'
import { act, fireEvent } from '@testing-library/react'
import { render, screen, waitFor, AllTheProviders } from 'util/testing/reactTestingLibraryExtended'
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

jest.mock('sonner', () => ({
  toast: {
    error: jest.fn(() => 'toast-id'),
    dismiss: jest.fn()
  }
}))

jest.mock('store/actions/trackAnalyticsEvent', () => jest.fn((eventName, data) => ({ type: 'TEST_TRACK_ANALYTICS_EVENT', eventName, data })))

jest.mock('store/actions/draftActions', () => ({
  ...jest.requireActual('store/actions/draftActions'),
  saveDraft: jest.fn(() => ({ type: 'TEST_SAVE_DRAFT' }))
}))

function testProviders ({ withLinkPreview, linkGroup, withJoinAnswer } = {}) {
  const ormSession = orm.mutableSession(orm.getEmptyState())
  ormSession.Me.create({ id: '1' })
  ormSession.Group.create({ id: '1', name: 'Test Group', slug: 'test-group' })
  if (withJoinAnswer) {
    ormSession.GroupJoinQuestionAnswer.create({ id: 'a1', answer: withJoinAnswer })
    ormSession.Membership.create({ id: 'm1', person: '1', group: '1', settings: {}, joinQuestionAnswers: ['a1'] })
  }
  const postAttrs = { id: '1', title: 'Test Post', type: 'discussion', groups: [{ id: '1', name: 'Test Group' }], topics: [{ name: 'design' }] }
  if (linkGroup) postAttrs.groups = ['1']
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

function draftResponse (draftData) {
  return graphql.query('FetchDraft', ({ variables }) => HttpResponse.json({
    data: {
      draft: {
        id: 'draft-1',
        type: 'post',
        data: JSON.stringify({ details: '', groups: ['1'], type: variables.postType, ...draftData }),
        groupId: '1',
        topicId: null,
        postId: null,
        messageThreadId: null,
        postType: variables.postType,
        isEdit: false,
        navigateTo: '/',
        updatedAt: '2026-09-01T00:00:00.000Z',
        group: { id: '1', name: 'Test Group', slug: 'test-group' },
        post: null,
        messageThread: null
      }
    }
  }))
}

function mockLocation (location) {
  require('react-router-dom').useLocation.mockReturnValue({ hash: '', state: null, key: 'default', ...location })
}

describe('PostEditor', () => {
  afterEach(() => {
    mockLocation({ pathname: '', search: '' })
  })

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

    it('says why it cannot post and focuses the title when a request has no title', async () => {
      jest.spyOn(require('react-router-dom'), 'useParams').mockReturnValue({ groupSlug: 'test-group' })
      mockLocation({ pathname: '/groups/test-group', search: '?create=post&newPostType=request' })
      const { container } = renderComponent({ autoFocus: false })
      const titleInput = await waitFor(() => {
        const input = container.querySelector('.PostEditorTitle input')
        expect(input).toBeInTheDocument()
        return input
      })

      fireEvent.click(screen.getByTestId('post-editor-submit'))

      expect(screen.getByRole('alert')).toHaveTextContent('Title is required')
      expect(titleInput).toHaveFocus()
    })

    it('does not ask for a title for a discussion, only for a title or some text', async () => {
      jest.spyOn(require('react-router-dom'), 'useParams').mockReturnValue({ groupSlug: 'test-group' })
      const { container } = renderComponent({ autoFocus: false })
      const titleInput = await waitFor(() => {
        const input = container.querySelector('.PostEditorTitle input')
        expect(input).toBeInTheDocument()
        return input
      })
      expect(titleInput).toHaveAttribute('placeholder', '(optional)')

      fireEvent.click(screen.getByTestId('post-editor-submit'))

      expect(screen.getByRole('alert')).toHaveTextContent('Add a title or some text')
      expect(screen.getByRole('alert')).not.toHaveTextContent('Title is required')
    })

    it('posts an untitled discussion with a title made from its text', async () => {
      const createPost = require('store/actions/createPost')
      createPost.mockClear()
      jest.spyOn(require('react-router-dom'), 'useParams').mockReturnValue({ groupSlug: 'test-group' })
      mockGraphqlServer.use(draftResponse({
        title: '',
        details: '<p>Hello everyone, this is <strong>my first</strong> discussion here and I am glad to finally be part of it all</p>'
      }))
      const { container } = renderComponent({ autoFocus: false })
      await waitFor(() => expect(container.querySelector('.ProseMirror')?.textContent).toContain('Hello everyone'))

      await act(async () => { fireEvent.click(screen.getByTestId('post-editor-submit')) })

      await waitFor(() => expect(createPost).toHaveBeenCalled())
      const { title, type } = createPost.mock.calls[0][0]
      expect(type).toBe('discussion')
      expect(title).toBe('Hello everyone, this is my first discussion here and I am glad to finally be…')
      expect(title.length).toBeLessThanOrEqual(80)
    }, 20000)

    it('keeps a new post as a draft and offers to open it when sending fails after the editor has closed', async () => {
      const createPost = require('store/actions/createPost')
      const { saveDraft } = require('store/actions/draftActions')
      const { toast } = require('sonner')
      toast.error.mockClear()
      saveDraft.mockClear()
      let rejectSave
      createPost.mockImplementationOnce(() => ({
        type: 'TEST_CREATE_POST',
        payload: new Promise((resolve, reject) => { rejectSave = reject })
      }))
      jest.spyOn(require('react-router-dom'), 'useParams').mockReturnValue({ groupSlug: 'test-group' })
      mockLocation({ pathname: '/groups/test-group', search: '?create=post' })
      mockGraphqlServer.use(draftResponse({ title: 'Never sent' }))
      const editorRef = React.createRef()

      const { unmount } = render(
        <PostEditor {...baseProps} ref={editorRef} />,
        { wrapper: testProviders() }
      )
      await screen.findByDisplayValue('Never sent')
      await act(async () => { editorRef.current.submit() })
      await waitFor(() => expect(createPost).toHaveBeenLastCalledWith(expect.objectContaining({ title: 'Never sent' })))
      saveDraft.mockClear()

      unmount()
      await act(async () => { rejectSave(new Error('offline')) })

      await waitFor(() => expect(toast.error).toHaveBeenCalledWith(
        'Your post wasn\'t sent!',
        expect.objectContaining({ action: expect.objectContaining({ label: 'View Draft' }) })
      ))
      // Kept right away, not after the autosave delay
      expect(saveDraft).toHaveBeenCalledWith(expect.objectContaining({ data: expect.stringContaining('Never sent') }))
      expect(require('store/actions/trackAnalyticsEvent')).toHaveBeenCalledWith('Post Failed', {
        postType: 'discussion',
        editing: false,
        editorOpen: false,
        discarded: false
      })

      await act(async () => { toast.error.mock.calls[0][1].action.onClick() })
      await waitFor(() => expect(`${window.location.pathname}${window.location.search}`).toBe('/groups/test-group?create=post&newPostType=discussion'))
    }, 20000)

    it('keeps no draft and shows nothing when the person discarded the post while it was being sent', async () => {
      const createPost = require('store/actions/createPost')
      const { saveDraft } = require('store/actions/draftActions')
      const { toast } = require('sonner')
      toast.error.mockClear()
      let rejectSave
      createPost.mockImplementationOnce(() => ({
        type: 'TEST_CREATE_POST',
        payload: new Promise((resolve, reject) => { rejectSave = reject })
      }))
      jest.spyOn(require('react-router-dom'), 'useParams').mockReturnValue({ groupSlug: 'test-group' })
      mockGraphqlServer.use(draftResponse({ title: 'Changed my mind' }))
      const editorRef = React.createRef()

      const { unmount } = render(
        <PostEditor {...baseProps} ref={editorRef} />,
        { wrapper: testProviders() }
      )
      await screen.findByDisplayValue('Changed my mind')
      await act(async () => { editorRef.current.submit() })
      await waitFor(() => expect(createPost).toHaveBeenLastCalledWith(expect.objectContaining({ title: 'Changed my mind' })))

      await act(async () => { editorRef.current.discard() })
      unmount()
      saveDraft.mockClear()
      await act(async () => { rejectSave(new Error('offline')) })
      await act(async () => { await new Promise(resolve => setTimeout(resolve, 2000)) })

      expect(toast.error).not.toHaveBeenCalled()
      expect(saveDraft).not.toHaveBeenCalled()
    }, 20000)

    it('restores attachments from a saved draft and saves changes to them', async () => {
      const { saveDraft } = require('store/actions/draftActions')
      saveDraft.mockClear()
      jest.spyOn(require('react-router-dom'), 'useParams').mockReturnValue({ groupSlug: 'test-group' })
      mockGraphqlServer.use(
        graphql.query('FetchDraft', ({ variables }) => HttpResponse.json({
          data: {
            draft: {
              id: 'draft-1',
              type: 'post',
              data: JSON.stringify({
                title: 'Draft with pictures',
                details: '',
                type: variables.postType,
                groups: ['1'],
                imageUrls: ['https://example.com/a.png', 'https://example.com/b.png'],
                fileUrls: []
              }),
              groupId: '1',
              topicId: null,
              postId: null,
              messageThreadId: null,
              postType: variables.postType,
              isEdit: false,
              navigateTo: '/',
              updatedAt: '2026-09-01T00:00:00.000Z',
              group: { id: '1', name: 'Test Group', slug: 'test-group' },
              post: null,
              messageThread: null
            }
          }
        }))
      )

      const { container } = renderComponent()
      await screen.findByDisplayValue('Draft with pictures')
      await screen.findByText('Images')
      expect(container.querySelectorAll('.image')).toHaveLength(2)

      fireEvent.click(container.querySelector('.image').parentElement.querySelector('.icon-Ex'))

      await waitFor(() => {
        const lastSave = saveDraft.mock.calls[saveDraft.mock.calls.length - 1]?.[0]
        expect(lastSave?.data).toContain('https://example.com/b.png')
        expect(lastSave?.data).not.toContain('https://example.com/a.png')
      }, { timeout: 4000 })
    }, 20000)
  })

  describe('from a template', () => {
    const editorText = container => container.querySelector('.ProseMirror')?.textContent

    beforeEach(() => {
      jest.spyOn(require('react-router-dom'), 'useParams').mockReturnValue({ groupSlug: 'test-group' })
    })

    it('starts an introduction with the text the group\'s stewards wrote', async () => {
      mockLocation({ pathname: '/groups/test-group', search: '?create=post&newPostType=discussion&template=intro' })
      mockGraphqlServer.use(graphql.query('GroupIntroTemplate', () => HttpResponse.json({
        data: { group: { id: '1', settings: { introTemplate: 'Say hi!\nWhat do you grow?' } } }
      })))
      const { container } = renderComponent({ autoFocus: false })

      await waitFor(() => expect(editorText(container)).toBe('Say hi!What do you grow?'))
      expect(container.querySelectorAll('.ProseMirror p')).toHaveLength(2)
    }, 20000)

    it('uses the standard introduction when the group has none, and nothing members wrote when joining', async () => {
      mockLocation({ pathname: '/groups/test-group', search: '?create=post&newPostType=discussion&template=intro' })
      mockGraphqlServer.use(graphql.query('GroupIntroTemplate', () => HttpResponse.json({
        data: { group: { id: '1', settings: { introTemplate: null } } }
      })))
      const { container } = renderComponent({ autoFocus: false }, { withJoinAnswer: 'My private answer for the stewards' })

      await waitFor(() => expect(editorText(container)).toBe('introTemplateDefault'))
      expect(container.textContent).not.toContain('My private answer for the stewards')
    }, 20000)

    it('starts a welcome post with the standard welcome', async () => {
      mockLocation({ pathname: '/groups/test-group', search: '?create=post&newPostType=discussion&template=welcome' })
      const { container } = renderComponent({ autoFocus: false })

      await waitFor(() => expect(editorText(container)).toBe('welcomeTemplateDefault'))
    }, 20000)

    it('opens a saved draft instead of the template', async () => {
      mockLocation({ pathname: '/groups/test-group', search: '?create=post&newPostType=discussion&template=intro' })
      mockGraphqlServer.use(
        graphql.query('GroupIntroTemplate', () => HttpResponse.json({ data: { group: { id: '1', settings: { introTemplate: 'Say hi!' } } } })),
        draftResponse({ title: '', details: '<p>What I had already written</p>' })
      )
      const { container } = renderComponent({ autoFocus: false })

      await waitFor(() => expect(editorText(container)).toBe('What I had already written'))
    }, 20000)
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

    it('keeps the post, re-enables draft saving and offers a retry when saving fails', async () => {
      const updatePost = require('store/actions/updatePost')
      const { saveDraft } = require('store/actions/draftActions')
      const { toast } = require('sonner')
      updatePost.mockImplementationOnce(() => ({ type: 'TEST_UPDATE_POST_FAILED', payload: Promise.reject(new Error('offline')) }))
      jest.spyOn(require('react-router-dom'), 'useParams').mockReturnValue({ groupSlug: 'test-group', postId: '1' })
      const afterSave = jest.fn()
      const editorRef = React.createRef()

      render(
        <PostEditor {...baseProps} {...editProps} afterSave={afterSave} ref={editorRef} />,
        { wrapper: testProviders({ linkGroup: true }) }
      )
      await screen.findByDisplayValue('Test Post')

      await act(async () => { await editorRef.current.submit() })

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith(
          'Your changes couldn\'t be saved',
          expect.objectContaining({ action: expect.objectContaining({ label: 'Try Again' }) })
        )
      })
      expect(afterSave).not.toHaveBeenCalled()
      expect(screen.getByDisplayValue('Test Post')).toBeInTheDocument()

      fireEvent.change(screen.getByDisplayValue('Test Post'), { target: { value: 'Test Post, edited' } })
      await waitFor(() => {
        expect(saveDraft).toHaveBeenCalledWith(expect.objectContaining({
          data: expect.stringContaining('Test Post, edited')
        }))
      }, { timeout: 4000 })

      const retry = toast.error.mock.calls[0][1].action.onClick
      await act(async () => { retry() })
      await waitFor(() => expect(afterSave).toHaveBeenCalled())
      expect(updatePost).toHaveBeenLastCalledWith(expect.objectContaining({ title: 'Test Post, edited' }))
    }, 20000)

    it('keeps the changes as a draft and offers to open them when saving fails after the editor has closed', async () => {
      const updatePost = require('store/actions/updatePost')
      const { saveDraft } = require('store/actions/draftActions')
      const { toast } = require('sonner')
      toast.error.mockClear()
      saveDraft.mockClear()
      let rejectSave
      updatePost.mockImplementationOnce(() => ({
        type: 'TEST_UPDATE_POST',
        payload: new Promise((resolve, reject) => { rejectSave = reject })
      }))
      jest.spyOn(require('react-router-dom'), 'useParams').mockReturnValue({ groupSlug: 'test-group', postId: '1' })
      mockLocation({ pathname: '/groups/test-group/post/1/edit', search: '' })
      const editorRef = React.createRef()

      const { unmount } = render(
        <PostEditor {...baseProps} {...editProps} afterSave={jest.fn()} ref={editorRef} />,
        { wrapper: testProviders({ linkGroup: true }) }
      )
      await screen.findByDisplayValue('Test Post')
      await act(async () => { editorRef.current.submit() })
      await waitFor(() => expect(updatePost).toHaveBeenLastCalledWith(expect.objectContaining({ title: 'Test Post' })))

      unmount()
      await act(async () => { rejectSave(new Error('offline')) })

      await waitFor(() => expect(toast.error).toHaveBeenCalledWith(
        'Your changes couldn\'t be saved',
        expect.objectContaining({ action: expect.objectContaining({ label: 'View Draft' }) })
      ))
      await waitFor(() => {
        expect(saveDraft).toHaveBeenCalledWith(expect.objectContaining({ data: expect.stringContaining('Test Post') }))
      })

      await act(async () => { toast.error.mock.calls[0][1].action.onClick() })
      await waitFor(() => expect(window.location.pathname).toBe('/groups/test-group/post/1/edit'))
    }, 20000)
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

  it('explains inline why an invalid post cannot be sent, instead of sending it', () => {
    const doSave = jest.fn()
    const onInvalidSubmit = jest.fn()
    render(
      <ActionsBar
        {...baseProps}
        valid={false}
        invalidMessage='Title is required<br />At least one group required'
        doSave={doSave}
        onInvalidSubmit={onInvalidSubmit}
      />
    )
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()

    const submitButton = screen.getByRole('button', { name: 'Post' })
    expect(submitButton).toHaveAttribute('aria-disabled', 'true')
    fireEvent.click(submitButton)

    const alert = screen.getByRole('alert')
    expect(alert).toHaveTextContent('Title is required')
    expect(alert).toHaveTextContent('At least one group required')
    expect(onInvalidSubmit).toHaveBeenCalled()
    expect(doSave).not.toHaveBeenCalled()
  })

  it('sends a valid post', () => {
    const doSave = jest.fn()
    render(<ActionsBar {...baseProps} doSave={doSave} />)
    fireEvent.click(screen.getByRole('button', { name: 'Post' }))
    expect(doSave).toHaveBeenCalled()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('hides the keyboard shortcut hint on touch devices', () => {
    const isMobile = require('ismobilejs')
    const wasMobile = isMobile.any
    isMobile.any = true
    try {
      render(<ActionsBar {...baseProps} />)
      expect(screen.queryByText(/Enter to post/)).not.toBeInTheDocument()
    } finally {
      isMobile.any = wasMobile
    }
    render(<ActionsBar {...baseProps} />)
    expect(screen.getByText(/Enter to post/)).toBeInTheDocument()
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
