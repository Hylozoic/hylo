import React from 'react'
import { render, screen, fireEvent, waitFor } from 'util/testing/reactTestingLibraryExtended'
import TopicSelector from './TopicSelector'

describe('TopicSelector', () => {
  const defaultProps = {
    fetchDefaultTopics: jest.fn(),
    findTopics: jest.fn(),
    onChange: jest.fn(),
  }

  const renderComponent = (props = {}) => {
    return render(<TopicSelector {...defaultProps} {...props} />)
  }

  it('renders correctly (with default props)', () => {
    renderComponent()
    expect(screen.getByPlaceholderText('Enter up to three topics...')).toBeInTheDocument()
  })

  it('calls fetchDefaultTopics on mount', () => {
    renderComponent({ forGroups: [{ slug: 'test-group' }] })
    expect(defaultProps.fetchDefaultTopics).toHaveBeenCalledWith({ groupSlug: 'test-group' })
  })

  it('updates selected topics when props change', async () => {
    const { rerender } = renderComponent()
    rerender(<TopicSelector {...defaultProps} selectedTopics={[{ name: 'one' }]} />)
    await waitFor(() => {
      expect(screen.getByText('#one')).toBeInTheDocument()
    })
  })

  it('allows selecting topics', async () => {
    defaultProps.findTopics.mockResolvedValue({
      payload: { getData: () => ({ items: [{ topic: { name: 'test-topic' } }] }) }
    })
    renderComponent()

    const input = screen.getByPlaceholderText('Enter up to three topics...')
    fireEvent.change(input, { target: { value: 'test' } })

    await waitFor(() => {
      expect(screen.getByText('test-topic')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByText('test-topic'))
    expect(screen.getByText('#test-topic')).toBeInTheDocument()
    expect(defaultProps.onChange).toHaveBeenCalledWith([{ name: 'test-topic' }])
  })

  it('limits selection to 3 topics', async () => {
    renderComponent({ selectedTopics: [{ name: 'one' }, { name: 'two' }, { name: 'three' }] })

    await waitFor(() => {
      expect(screen.getByText('#one')).toBeInTheDocument()
      expect(screen.getByText('#two')).toBeInTheDocument()
      expect(screen.getByText('#three')).toBeInTheDocument()
    })

    const input = screen.getByPlaceholderText('Enter up to three topics...')
    fireEvent.change(input, { target: { value: 'four' } })

    await waitFor(() => {
      expect(screen.getByText('You can only select up to 3 topics')).toBeInTheDocument()
    })
  })

  it('allows creating new topics', async () => {
    renderComponent()

    const input = screen.getByPlaceholderText('Enter up to three topics...')
    fireEvent.change(input, { target: { value: 'new-topic' } })

    await waitFor(() => {
      expect(screen.getByText('Create topic "#new-topic"')).toBeInTheDocument()
    })

    fireEvent.keyDown(input, { key: 'Enter', code: 'Enter' })
    expect(screen.getByText('#new-topic')).toBeInTheDocument()
    expect(defaultProps.onChange).toHaveBeenCalledWith([{ name: 'new-topic', value: 'new-topic', __isNew__: true }])
  })
})
