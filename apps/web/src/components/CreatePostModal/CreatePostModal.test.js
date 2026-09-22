import React from 'react'
import { useLocation } from 'react-router-dom'
import orm from 'store/models'
import { AllTheProviders, render, screen } from 'util/testing/reactTestingLibraryExtended'
import CreatePostModal from './CreatePostModal'

jest.mock('components/PostEditor', () => {
  const React = require('react')
  return React.forwardRef(function MockPostEditor () {
    return <div>Post Editor</div>
  })
})

function testProviders () {
  const ormSession = orm.mutableSession(orm.getEmptyState())
  ormSession.Me.create({ id: '1' })
  return AllTheProviders({ orm: ormSession.state })
}

it('renders nothing when create is not open', () => {
  useLocation.mockReturnValue({ pathname: '/all/all', search: '' })

  const { container } = render(
    <CreatePostModal />,
    { wrapper: testProviders() }
  )

  expect(container.querySelector('#create-modal-content')).not.toBeInTheDocument()
})

it('renders the post editor when create=post', () => {
  useLocation.mockReturnValue({ pathname: '/all/all', search: '?create=post' })

  render(
    <CreatePostModal />,
    { wrapper: testProviders() }
  )

  expect(screen.getByText('Post Editor')).toBeInTheDocument()
})
