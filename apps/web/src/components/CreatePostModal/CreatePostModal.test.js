import React from 'react'
import { useLocation } from 'react-router-dom'
import { fireEvent } from '@testing-library/react'
import orm from 'store/models'
import trackAnalyticsEvent from 'store/actions/trackAnalyticsEvent'
import { AllTheProviders, render, screen } from 'util/testing/reactTestingLibraryExtended'
import CreatePostModal, { composerEntryPoint } from './CreatePostModal'

const mockEditorHandle = { discard: jest.fn(), resetToInitial: jest.fn(), submit: jest.fn() }

jest.mock('components/PostEditor', () => {
  const React = require('react')
  return React.forwardRef(function MockPostEditor ({ setIsDirty }, ref) {
    React.useImperativeHandle(ref, () => mockEditorHandle)
    return <button type='button' onClick={() => setIsDirty(true)}>Post Editor</button>
  })
})

jest.mock('store/actions/trackAnalyticsEvent', () => jest.fn((eventName, data) => ({ type: 'TEST_TRACK_ANALYTICS_EVENT', eventName, data })))

function testProviders () {
  const ormSession = orm.mutableSession(orm.getEmptyState())
  ormSession.Me.create({ id: '1' })
  return AllTheProviders({ orm: ormSession.state })
}

beforeEach(() => {
  trackAnalyticsEvent.mockClear()
  mockEditorHandle.discard.mockClear()
})

it('renders nothing when create is not open', () => {
  useLocation.mockReturnValue({ pathname: '/all/all', search: '' })

  const { container } = render(
    <CreatePostModal />,
    { wrapper: testProviders() }
  )

  expect(container.querySelector('#create-modal-content')).not.toBeInTheDocument()
  expect(trackAnalyticsEvent).not.toHaveBeenCalled()
})

it('renders the post editor when create=post', () => {
  useLocation.mockReturnValue({ pathname: '/all/all', search: '?create=post' })

  render(
    <CreatePostModal />,
    { wrapper: testProviders() }
  )

  expect(screen.getByText('Post Editor')).toBeInTheDocument()
})

it('reports once where the composer was opened from', () => {
  useLocation.mockReturnValue({ pathname: '/groups/a', search: '?create=post&newPostType=offer&composerEntry=new_button', key: 'x1' })

  const { rerender } = render(<CreatePostModal />, { wrapper: testProviders() })
  rerender(<CreatePostModal />)

  expect(trackAnalyticsEvent).toHaveBeenCalledTimes(1)
  expect(trackAnalyticsEvent).toHaveBeenCalledWith('Composer Opened', { entryPoint: 'new_button', postType: 'offer', template: null })
})

it('reports discarding and saving a draft when closing', () => {
  useLocation.mockReturnValue({ pathname: '/groups/a', search: '?create=post', key: 'x2' })
  render(<CreatePostModal />, { wrapper: testProviders() })
  fireEvent.click(screen.getByText('Post Editor'))

  fireEvent.click(document.querySelector('.icon-Ex').parentElement)
  fireEvent.click(screen.getByText('Discard'))

  expect(trackAnalyticsEvent).toHaveBeenCalledWith('Composer Abandoned', { outcome: 'discard', editing: false })
  expect(mockEditorHandle.discard).toHaveBeenCalled()
})

it('reports saving a draft when closing', () => {
  useLocation.mockReturnValue({ pathname: '/groups/a', search: '?create=post', key: 'x3' })
  render(<CreatePostModal />, { wrapper: testProviders() })
  fireEvent.click(screen.getByText('Post Editor'))

  fireEvent.click(document.querySelector('.icon-Ex').parentElement)
  fireEvent.click(screen.getByText('Save'))

  expect(trackAnalyticsEvent).toHaveBeenCalledWith('Composer Abandoned', { outcome: 'save_draft', editing: false })
  expect(mockEditorHandle.discard).not.toHaveBeenCalled()
})

describe('composerEntryPoint', () => {
  it('names the entry, a template link, a link opened directly, or somewhere else', () => {
    expect(composerEntryPoint({ search: '?create=post&composerEntry=create_menu', key: 'k' })).toBe('create_menu')
    expect(composerEntryPoint({ search: '?create=post&template=intro', key: 'k' })).toBe('template')
    expect(composerEntryPoint({ search: '?create=post', key: 'default' })).toBe('deep_link')
    expect(composerEntryPoint({ search: '?create=post', key: 'k' })).toBe('other')
  })
})
