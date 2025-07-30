import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { Provider } from 'react-redux'
import configureStore from 'redux-mock-store'
import SingleTopicSelector from './SingleTopicSelector'
import findTopics from 'store/actions/findTopics'

// Mock the store actions
jest.mock('store/actions/findTopics')

const mockStore = configureStore()

describe('SingleTopicSelector', () => {
  let store
  const defaultProps = {
    currentGroup: { name: 'Test Group' },
    forGroups: [],
    onSelectTopic: jest.fn()
  }

  beforeEach(() => {
    store = mockStore({})
    findTopics.mockResolvedValue({
      payload: {
        data: {
          groupTopics: {
            items: [
              {
                topic: {
                  name: 'test-topic',
                  followersTotal: 100,
                  postsTotal: 50
                }
              }
            ]
          }
        }
      }
    })
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  const renderComponent = (props = {}) => {
    return render(
      <Provider store={store}>
        <SingleTopicSelector {...defaultProps} {...props} />
      </Provider>
    )
  }

  it('renders', () => {
    renderComponent()
    expect(screen.getByText('Find/add a topic')).toBeInTheDocument()
  })

  it('handles topic search', async () => {
    renderComponent()
    const input = screen.getByRole('combobox')
    
    fireEvent.change(input, { target: { value: 'test' } })
    
    await waitFor(() => {
      expect(findTopics).toHaveBeenCalledWith({ autocomplete: 'test' })
    })
  })

  it('calls onSelectTopic when a topic is selected', async () => {
    const onSelectTopic = jest.fn()
    renderComponent({ onSelectTopic })
    
    const input = screen.getByRole('combobox')
    fireEvent.change(input, { target: { value: 'test-topic' } })
    
    await waitFor(() => {
      expect(screen.getByText(/test-topic/)).toBeInTheDocument()
    })
    
    fireEvent.click(screen.getByText(/test-topic/))
    expect(onSelectTopic).toHaveBeenCalledWith({'__isNew__': true, 'label': 'test-topic', 'name': 'test-topic', 'value': 'test-topic'})
  })

  it('allows creating new topics', async () => {
    const onSelectTopic = jest.fn()
    renderComponent({ onSelectTopic })
    
    const input = screen.getByRole('combobox')
    fireEvent.change(input, { target: { value: 'new-topic' } })
    
    await waitFor(() => {
      expect(screen.getByText('Create topic "new-topic"')).toBeInTheDocument()
    })
    
    fireEvent.click(screen.getByText('Create topic "new-topic"'))
    expect(onSelectTopic).toHaveBeenCalledWith({'__isNew__': true, 'label': 'new-topic', 'name': 'new-topic', 'value': 'new-topic'})
  })

  it('disables new topic creation for short topics', async () => {
    renderComponent()
    
    const input = screen.getByRole('combobox')
    fireEvent.change(input, { target: { value: 'ab' } })
    
    await waitFor(() => {
      expect(screen.getByText('Topics must be longer than 2 characters')).toBeInTheDocument()
    })
  })

  it.skip('formats follower and post counts correctly', async () => {
    renderComponent()
    
    const input = screen.getByRole('combobox')
    fireEvent.change(input, { target: { value: 'test-topic' } })
    
    await waitFor(() => {
      expect(screen.getByText('100 subscribers')).toBeInTheDocument()
      expect(screen.getByText('50 posts')).toBeInTheDocument()
    })
  })
}) 