/* eslint-env jest */
import React from 'react'
import { useLocation, useParams } from 'react-router-dom'
import { fireEvent } from '@testing-library/react'
import orm from 'store/models'
import { AllTheProviders, render, screen } from 'util/testing/reactTestingLibraryExtended'
import NoPosts from './index'

function providers ({ member = true, acceptedPostTypes, settings = {} } = {}) {
  const session = orm.mutableSession(orm.getEmptyState())
  session.Me.create({ id: '1', name: 'Test User', settings })
  session.Group.create({ id: '7', name: 'Quiet Group', slug: 'quiet-group', acceptedPostTypes })
  if (member) session.Membership.create({ id: 'm7', person: '1', group: '7' })
  return AllTheProviders({ orm: session.state })
}

function atRoute ({ view = 'stream', search = '' } = {}) {
  useParams.mockReturnValue({ context: 'groups', groupSlug: 'quiet-group', view })
  useLocation.mockReturnValue({ pathname: `/groups/quiet-group/${view}`, search })
}

afterEach(() => {
  useParams.mockReturnValue({})
  useLocation.mockReturnValue({ pathname: '', search: '' })
})

describe('NoPosts', () => {
  it('offers a primary and a secondary action', () => {
    const onAction = jest.fn()
    const onSecondaryAction = jest.fn()
    render(
      <NoPosts
        message="You're not in any groups yet"
        actionLabel='Explore Groups'
        onAction={onAction}
        secondaryActionLabel='Create a group'
        onSecondaryAction={onSecondaryAction}
      />
    )

    expect(screen.getByText('You\'re not in any groups yet')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Explore Groups' }))
    fireEvent.click(screen.getByRole('button', { name: 'Create a group' }))
    expect(onAction).toHaveBeenCalledTimes(1)
    expect(onSecondaryAction).toHaveBeenCalledTimes(1)
  })

  it('shows no buttons without actions', () => {
    render(<NoPosts message='Nothing here yet' />)
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })

  describe('in a group with no posts', () => {
    const emptyStream = <NoPosts message='Nothing here yet' actionLabel='Create something' onAction={jest.fn()} />

    it('invites members to introduce themselves, opening the composer with the introduction template', () => {
      atRoute()
      render(emptyStream, { wrapper: providers() })

      fireEvent.click(screen.getByRole('button', { name: 'Introduce yourself' }))

      expect(screen.getByRole('button', { name: 'Create something' })).toBeInTheDocument()
      const opened = new URL(window.location.href)
      expect(opened.pathname).toBe('/groups/quiet-group/stream')
      expect(opened.searchParams.get('create')).toBe('post')
      expect(opened.searchParams.get('newPostType')).toBe('discussion')
      expect(opened.searchParams.get('template')).toBe('intro')
      expect(opened.searchParams.get('composerEntry')).toBe('empty_state')
    })

    it('does not invite people who are not members', () => {
      atRoute()
      render(emptyStream, { wrapper: providers({ member: false }) })
      expect(screen.queryByRole('button', { name: 'Introduce yourself' })).not.toBeInTheDocument()
    })

    it('does not invite in groups that take no discussions', () => {
      atRoute()
      render(emptyStream, { wrapper: providers({ acceptedPostTypes: ['event'] }) })
      expect(screen.queryByRole('button', { name: 'Introduce yourself' })).not.toBeInTheDocument()
    })

    it('leaves other views, filtered streams and load errors alone', () => {
      atRoute({ view: 'events' })
      const { unmount } = render(emptyStream, { wrapper: providers() })
      expect(screen.queryByRole('button', { name: 'Introduce yourself' })).not.toBeInTheDocument()
      unmount()

      atRoute({ search: '?search=seeds' })
      const filtered = render(emptyStream, { wrapper: providers() })
      expect(screen.queryByRole('button', { name: 'Introduce yourself' })).not.toBeInTheDocument()
      filtered.unmount()

      atRoute()
      render(<NoPosts message="Couldn't load posts" actionLabel='Try Again' onAction={jest.fn()} />, { wrapper: providers() })
      expect(screen.queryByRole('button', { name: 'Introduce yourself' })).not.toBeInTheDocument()
    })

    it('leaves streams narrowed by a saved filter alone, since the group may have posts', () => {
      atRoute()
      const savedType = render(emptyStream, { wrapper: providers({ settings: { streamPostType: 'request' } }) })
      expect(screen.queryByRole('button', { name: 'Introduce yourself' })).not.toBeInTheDocument()
      savedType.unmount()

      const activeOnly = render(emptyStream, { wrapper: providers({ settings: { activePostsOnly: true } }) })
      expect(screen.queryByRole('button', { name: 'Introduce yourself' })).not.toBeInTheDocument()
      activeOnly.unmount()

      atRoute({ search: '?activeOnly=false' })
      const allPosts = render(emptyStream, { wrapper: providers({ settings: { activePostsOnly: true } }) })
      expect(screen.getByRole('button', { name: 'Introduce yourself' })).toBeInTheDocument()
      allPosts.unmount()

      atRoute({ view: 'discussions' })
      render(emptyStream, { wrapper: providers({ settings: { streamPostType: 'request' } }) })
      expect(screen.getByRole('button', { name: 'Introduce yourself' })).toBeInTheDocument()
    })

    it('follows the stream when it says whether to offer an introduction', () => {
      atRoute({ view: 'events' })
      const offered = render(<NoPosts message='Nothing here yet' offerIntroduction />, { wrapper: providers() })
      expect(screen.getByRole('button', { name: 'Introduce yourself' })).toBeInTheDocument()
      offered.unmount()

      atRoute()
      render(<NoPosts {...emptyStream.props} offerIntroduction={false} />, { wrapper: providers() })
      expect(screen.queryByRole('button', { name: 'Introduce yourself' })).not.toBeInTheDocument()
    })
  })
})
