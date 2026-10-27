/* eslint-env jest */
import React from 'react'
import mockGraphqlServer from 'util/testing/mockGraphqlServer'
import { graphql, HttpResponse } from 'msw'
import { render, screen, waitFor, AllTheProviders } from 'util/testing/reactTestingLibraryExtended'
import userEvent from '@testing-library/user-event'
import orm from 'store/models'
import createPost from 'store/actions/createPost'
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

function testProviders ({ withLinkPreview, postType = 'discussion', title = 'Test Post' } = {}) {
  const ormSession = orm.mutableSession(orm.getEmptyState())
  ormSession.Me.create({ id: '1' })
  ormSession.Group.create({ id: '1', name: 'Test Group', slug: 'test-group' })
  const postAttrs = { id: '1', title, type: postType, groups: [{ id: '1', name: 'Test Group' }], topics: [{ name: 'design' }] }
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

  describe('when the server rejects a new post', () => {
    const newPostProps = {
      post: { type: 'discussion', title: 'Hello', groups: [{ id: '1', name: 'Test Group' }] }
    }
    const threeDestinations = [
      { id: '1', name: 'Test Group' },
      { id: '3', name: 'Other Group' },
      { id: '2', name: 'partnerships', type: 'space', parentId: '1' }
    ]

    // Run the real createPost action against an msw CreatePost response with these errors
    function rejectCreatePost (errors) {
      createPost.mockImplementationOnce(jest.requireActual('store/actions/createPost').default)
      mockGraphqlServer.use(
        graphql.mutation('CreatePost', () => HttpResponse.json({ data: null, errors }))
      )
    }

    // The backend's post-type rejection: structured data plus an English fallback message
    const postTypeRejection = (destinations, postType = 'discussion') => ({
      message: 'English fallback from the server',
      path: ['createPost'],
      extensions: { code: 'POST_TYPE_NOT_ACCEPTED', postType, destinations }
    })

    // useTranslation is mocked globally (t returns the key); use real i18next for these tests
    async function withRealTranslation (lng) {
      const i18next = require('i18next')
      const i18n = i18next.createInstance()
      await i18n.init({
        lng,
        fallbackLng: 'en',
        resources: {
          en: { translation: require('../../../public/locales/en.json') },
          de: { translation: require('../../../public/locales/de.json') }
        },
        keySeparator: false,
        nsSeparator: false,
        interpolation: { escapeValue: false }
      })
      return jest.spyOn(require('react-i18next'), 'useTranslation')
        .mockReturnValue({ t: i18n.t.bind(i18n), i18n })
    }

    async function submitAndGetBanner () {
      const submit = await screen.findByTestId('post-editor-submit')
      await waitFor(() => expect(submit).not.toBeDisabled())
      await userEvent.click(submit)
      return screen.findByTestId('post-editor-save-error')
    }

    let translationSpy
    afterEach(() => {
      if (translationSpy) translationSpy.mockRestore()
      translationSpy = null
    })

    it('builds the message from the error data, naming only the blocking space', async () => {
      translationSpy = await withRealTranslation('en-US')
      rejectCreatePost([postTypeRejection(['Test Group / partnerships'])])
      const afterSave = jest.fn()
      renderComponent({ post: { type: 'discussion', title: 'Hello', groups: threeDestinations }, afterSave })

      const banner = await submitAndGetBanner()
      expect(banner.textContent).toBe('Test Group / partnerships does not accept Discussion posts')
      expect(banner).not.toHaveTextContent('Other Group')
      expect(afterSave).not.toHaveBeenCalled()
    })

    it('joins two blockers and uses the plural verb', async () => {
      translationSpy = await withRealTranslation('en-US')
      rejectCreatePost([postTypeRejection(['Test Group / partnerships', 'Other Group'])])
      renderComponent({ post: { type: 'discussion', title: 'Hello', groups: threeDestinations } })

      const banner = await submitAndGetBanner()
      expect(banner.textContent).toBe('Test Group / partnerships and Other Group do not accept Discussion posts')
    })

    it("builds the message in the user's language", async () => {
      translationSpy = await withRealTranslation('de-DE')
      rejectCreatePost([postTypeRejection(['Test Group / partnerships', 'Other Group'])])
      renderComponent({ post: { type: 'discussion', title: 'Hello', groups: threeDestinations } })

      const banner = await submitAndGetBanner()
      expect(banner.textContent).toBe('Test Group / partnerships und Other Group akzeptieren keine Beiträge vom Typ „Diskussion“')
    })

    it("shows the server's message for other errors", async () => {
      rejectCreatePost([{ message: 'unable to post to all those groups', path: ['createPost'] }])
      renderComponent(newPostProps)

      const banner = await submitAndGetBanner()
      expect(banner.textContent).toBe('unable to post to all those groups')
    })

    it('shows a generic error when the action resolves with an error and no message', async () => {
      createPost.mockImplementationOnce(() => ({ type: 'CREATE_POST', error: true, payload: {} }))
      renderComponent(newPostProps)

      const banner = await submitAndGetBanner()
      expect(banner).toHaveTextContent('There was an error, please try again.')
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

  it('renders every action as a 24x24 Lucide icon and highlights selected ones', async () => {
    render(<ActionsBar {...baseProps} canMakeAnnouncement announcementSelected showImages />)
    await waitFor(() => {
      for (const id of ['add-image-icon', 'add-file-icon', 'announcement-icon']) {
        const icon = screen.getByTestId(id)
        expect(icon.tagName.toLowerCase()).toBe('svg')
        expect(icon).toHaveClass('lucide', 'w-6', 'h-6')
      }
      expect(screen.getByTestId('add-image-icon')).toHaveClass('text-[#0DC39F]', 'cursor-default')
      expect(screen.getByTestId('announcement-icon')).toHaveClass('text-[#0DC39F]', 'cursor-default')
      expect(screen.getByTestId('add-file-icon')).not.toHaveClass('cursor-default')
    })
  })

  it('does not show announcement icon when user cannot make announcements', async () => {
    render(<ActionsBar {...baseProps} canMakeAnnouncement={false} />)
    await waitFor(() => {
      expect(screen.queryByTestId('announcement-icon')).not.toBeInTheDocument()
    })
  })
})
