import React from 'react'
import { fireEvent, render, screen, waitFor } from 'util/testing/reactTestingLibraryExtended'
import CreateTopic from './CreateTopic'

describe('CreateTopic', () => {
  const defaultProps = {
    groupId: '1',
    groupSlug: 'wombat-group',
    groupTopicExists: {
      wombats: {
        'wombat-group': false,
        'other-group': true
      },
      xylophones: {
        'wombat-group': true
      }
    },
    subscribeAfterCreate: true,
    topics: [
      {
        id: '3',
        name: 'flarglebargles',
        value: 'flarglebargles'
      }
    ],
    createTopic: jest.fn(),
    fetchGroupTopic: jest.fn()
  }

  it('renders create topic button when buttonText is provided', () => {
    render(<CreateTopic {...defaultProps} buttonText='Create a Topic' />)
    expect(screen.getByText('Create a Topic')).toBeInTheDocument()
  })

  it('renders create topic icon when buttonText is not provided', () => {
    render(<CreateTopic {...defaultProps} />)
    expect(screen.getByTestId('icon-Plus')).toBeInTheDocument()
  })

  it('opens modal when create button is clicked', () => {
    render(<CreateTopic {...defaultProps} buttonText='Create a Topic' />)
    fireEvent.click(screen.getByText('Create a Topic'))
    expect(screen.getByText('Create a Topic')).toBeInTheDocument()
    expect(screen.getByLabelText('topic-name')).toBeInTheDocument()
  })

  it('disables submit button when topic name is empty', () => {
    render(<CreateTopic {...defaultProps} buttonText='Create a Topic' />)
    fireEvent.click(screen.getByText('Create a Topic'))
    expect(screen.getByText('Add Topic')).toBeDisabled()
  })

  it('enables submit button when topic name is not empty', () => {
    render(<CreateTopic {...defaultProps} buttonText='Create a Topic' />)
    fireEvent.click(screen.getByText('Create a Topic'))
    fireEvent.change(screen.getByLabelText('topic-name'), { target: { value: 'New Topic' } })
    expect(screen.getByText('Add Topic')).not.toBeDisabled()
  })

  it('calls createTopic when submitting a new topic', async () => {
    render(<CreateTopic {...defaultProps} buttonText='Create a Topic' />)
    fireEvent.click(screen.getByText('Create a Topic'))
    fireEvent.change(screen.getByLabelText('topic-name'), { target: { value: 'New Topic' } })
    fireEvent.click(screen.getByText('Add Topic'))

    await waitFor(() => {
      expect(defaultProps.createTopic).toHaveBeenCalledWith('New Topic', '1', false, true)
    })
  })

  it('shows error message for invalid topic name', async () => {
    render(<CreateTopic {...defaultProps} buttonText='Create a Topic' />)
    fireEvent.click(screen.getByText('Create a Topic'))
    fireEvent.change(screen.getByLabelText('topic-name'), { target: { value: 'Invalid@Topic' } })

    await waitFor(() => {
      expect(screen.getByText(/Topic names can only contain/)).toBeInTheDocument()
    })
  })

  it('allows leading `#` characters in topic name', async () => {
    render(<CreateTopic {...defaultProps} buttonText='Create a Topic' />)
    fireEvent.click(screen.getByText('Create a Topic'))
    fireEvent.change(screen.getByLabelText('topic-name'), { target: { value: '#ValidTopic' } })
    fireEvent.click(screen.getByText('Add Topic'))

    await waitFor(() => {
      expect(defaultProps.createTopic).toHaveBeenCalledWith('ValidTopic', '1', false, true)
    })
  })

  it('shows success message after creating a topic', async () => {
    render(<CreateTopic {...defaultProps} buttonText='Create a Topic' />)
    fireEvent.click(screen.getByText('Create a Topic'))
    fireEvent.change(screen.getByLabelText('topic-name'), { target: { value: 'NewTopic' } })
    fireEvent.click(screen.getByText('Add Topic'))

    await waitFor(() => {
      expect(screen.getByText('Topic Created')).toBeInTheDocument()
      expect(screen.getByText("you're subscribed to #NewTopic")).toBeInTheDocument()
    })
  })
})
