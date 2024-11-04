/* eslint-env jest */
import React from 'react'
import { render, screen, fireEvent, waitFor } from 'util/testing/reactTestingLibraryExtended'
import PostEditor, { ActionsBar } from './PostEditor'

jest.mock('lodash/debounce', () => fn => {
  fn.cancel = jest.fn()
  return fn
})

describe('PostEditor', () => {
  const baseProps = {
    currentUser: { id: '1', avatarUrl: 'https://example.com/avatar.jpg' },
    groupOptions: [{ id: '1', name: 'Test Group' }],
    myAdminGroups: [],
    context: 'group'
  }

  const renderComponent = (props = {}) => {
    return render(
      <PostEditor {...baseProps} {...props} />
    )
  }

  it('renders with min props', () => {
    renderComponent()
    expect(screen.getByPlaceholderText('Add a title')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('Add a description')).toBeInTheDocument()
  })

  it('renders announcement option with admin in props', () => {
    const props = {
      ...baseProps,
      myAdminGroups: [{ id: '1', name: 'Admin Group' }]
    }
    renderComponent(props)
    expect(screen.getByTestId('announcement-icon')).toBeInTheDocument()
  })

  describe('for a new post', () => {
    it('renders initial prompt and placeholders', () => {
      renderComponent({ initialPrompt: 'a test prompt' })
      expect(screen.getByPlaceholderText('Add a title')).toBeInTheDocument()
      expect(screen.getByPlaceholderText('Add a description')).toBeInTheDocument()
    })

    it('renders correct title placeholder for different post types', () => {
      const postTypes = ['discussion', 'request', 'offer', 'resource']
      postTypes.forEach(type => {
        renderComponent({ post: { type } })
        expect(screen.getByPlaceholderText('Add a title')).toBeInTheDocument()
      })
    })

    it('calls createPost when saving a new post', async () => {
      const createPostMock = jest.fn(() => Promise.resolve())
      renderComponent({
        createPost: createPostMock,
        fetchLocation: jest.fn().mockReturnValue('8778'),
        ensureLocationIdIfCoordinate: jest.fn().mockResolvedValue('666')
      })

      fireEvent.change(screen.getByPlaceholderText('Add a title'), { target: { value: 'Test Title' } })
      fireEvent.click(screen.getByText('Post'))

      await waitFor(() => {
        expect(createPostMock).toHaveBeenCalled()
      })
    })
  })

  describe('for a new event', () => {
    it('renders correctly', () => {
      renderComponent({ isEvent: true, post: { groups: [] } })
      expect(screen.getByText('Timeframe')).toBeInTheDocument()
      expect(screen.getByText('Location')).toBeInTheDocument()
    })
  })

  describe('editing a post', () => {
    const editProps = {
      editing: true,
      post: {
        id: 'test',
        type: 'request',
        title: 'Test Title',
        groups: [{ id: '1', name: 'Test Group' }],
        topics: [{ name: 'design' }]
      },
      updatePost: jest.fn(() => Promise.resolve()),
      showImagePreviews: true,
      ensureLocationIdIfCoordinate: jest.fn().mockResolvedValue('555'),
      setIsDirty: jest.fn()
    }

    it('loads post data into fields', () => {
      renderComponent(editProps)
      expect(screen.getByDisplayValue('Test Title')).toBeInTheDocument()
    })

    it('calls updatePost when saving an edited post', async () => {
      renderComponent(editProps)
      fireEvent.click(screen.getByText('Save'))

      await waitFor(() => {
        expect(editProps.updatePost).toHaveBeenCalled()
      })
    })

    it('tracks dirty state when content changes', () => {
      renderComponent(editProps)
      fireEvent.change(screen.getByDisplayValue('Test Title'), { target: { value: 'New Title' } })
      expect(editProps.setIsDirty).toHaveBeenCalled()
    })

    it('shows error for invalid title length', () => {
      renderComponent(editProps)
      fireEvent.change(screen.getByDisplayValue('Test Title'), { target: { value: 'x'.repeat(81) } })
      expect(screen.getByText('Title limited to 80 characters')).toBeInTheDocument()
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

  it('renders correctly', () => {
    render(<ActionsBar {...baseProps} />)
    expect(screen.getByText('Post')).toBeInTheDocument()
    expect(screen.getByTestId('add-image-icon')).toBeInTheDocument()
    expect(screen.getByTestId('add-file-icon')).toBeInTheDocument()
  })

  it('disables post button when invalid', () => {
    render(<ActionsBar {...baseProps} valid={false} />)
    expect(screen.getByText('Post')).toBeDisabled()
  })

  it('shows announcement icon when user can make announcements', () => {
    render(<ActionsBar {...baseProps} canMakeAnnouncement />)
    expect(screen.getByTestId('announcement-icon')).toBeInTheDocument()
  })

  it('does not show announcement icon when user cannot make announcements', () => {
    render(<ActionsBar {...baseProps} canMakeAnnouncement={false} />)
    expect(screen.queryByTestId('announcement-icon')).not.toBeInTheDocument()
  })
})
