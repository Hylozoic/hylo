import React from 'react'
import userEvent from '@testing-library/user-event'
import { graphql, HttpResponse } from 'msw'
import orm from 'store/models'
import mockGraphqlServer from 'util/testing/mockGraphqlServer'
import { AllTheProviders, render, screen, waitFor } from 'util/testing/reactTestingLibraryExtended'
import ProfileNudge from './ProfileNudge'
import { isMissingPhotoOrLocation } from './profileNudgeState'

const PLACEHOLDER = 'https://www.gravatar.com/avatar/abc?d=mm&s=140'
const TITLE = 'Help people recognize you'

function providers ({ settings = { profileNudge: 'pending' }, avatarUrl = PLACEHOLDER, location = null, posts = [] } = {}) {
  const session = orm.mutableSession(orm.getEmptyState())
  session.Me.create({ id: '1', name: 'New Person', avatarUrl, location, settings })
  session.Person.create({ id: '1', name: 'New Person' })
  session.Person.create({ id: '2', name: 'Someone Else' })
  posts.forEach(post => session.Post.create(post))
  return AllTheProviders({ orm: session.state })
}

let settingsChanges

beforeEach(() => {
  settingsChanges = []
  mockGraphqlServer.use(
    graphql.operation(({ query, variables }) => {
      if (!query.includes('updateMe(')) return
      settingsChanges.push(variables.changes)
      return HttpResponse.json({
        data: { updateMe: { id: '1', settings: { signupInProgress: false, ...variables.changes.settings } } }
      })
    })
  )
})

describe('ProfileNudge', () => {
  it('asks once for a photo and location after the first post, and remembers Not now', async () => {
    const user = userEvent.setup()
    render(<ProfileNudge />, null, providers({ posts: [{ id: '10', creator: '1', type: 'discussion' }] }))

    expect(await screen.findByText(TITLE, {}, { timeout: 3000 })).toBeInTheDocument()
    expect(screen.getByPlaceholderText('Where do you call home?')).toBeInTheDocument()
    expect(screen.getByTestId('profile-nudge-save')).toBeDisabled()

    await user.click(screen.getByTestId('profile-nudge-not-now'))

    await waitFor(() => expect(settingsChanges).toEqual([{ settings: { profileNudge: 'dismissed' } }]))
    await waitFor(() => expect(screen.queryByText(TITLE)).not.toBeInTheDocument())
    await new Promise(resolve => setTimeout(resolve, 1500))
    expect(screen.queryByText(TITLE)).not.toBeInTheDocument()
    expect(settingsChanges).toHaveLength(1)
  })

  it('also counts a chat message as a first post', async () => {
    render(<ProfileNudge />, null, providers({ posts: [{ id: '11', creator: '1', type: 'chat' }] }))
    expect(await screen.findByText(TITLE, {}, { timeout: 3000 })).toBeInTheDocument()
  })

  it('waits while the post is still being sent, and ignores other people\'s posts', async () => {
    render(<ProfileNudge />, null, providers({
      posts: [
        { id: 'post_1', creator: '1', type: 'discussion' },
        { id: '12', creator: '2', type: 'discussion' },
        { id: '13', creator: '1', type: 'chat_activity' }
      ]
    }))
    await new Promise(resolve => setTimeout(resolve, 1500))
    expect(screen.queryByText(TITLE)).not.toBeInTheDocument()
  })

  it('never asks people who were not sent past those steps, or who already answered', async () => {
    const posts = [{ id: '14', creator: '1', type: 'discussion' }]
    const first = render(<ProfileNudge />, null, providers({ settings: {}, posts }))
    await new Promise(resolve => setTimeout(resolve, 1500))
    expect(screen.queryByText(TITLE)).not.toBeInTheDocument()
    first.unmount()

    render(<ProfileNudge />, null, providers({ settings: { profileNudge: 'dismissed' }, posts }))
    await new Promise(resolve => setTimeout(resolve, 1500))
    expect(screen.queryByText(TITLE)).not.toBeInTheDocument()
    expect(settingsChanges).toEqual([])
  })

  it('does not ask someone who already has a photo and a location', async () => {
    render(<ProfileNudge />, null, providers({
      avatarUrl: 'https://example.com/me.png',
      location: 'Lisbon, Portugal',
      posts: [{ id: '15', creator: '1', type: 'discussion' }]
    }))
    await new Promise(resolve => setTimeout(resolve, 1500))
    expect(screen.queryByText(TITLE)).not.toBeInTheDocument()
  })
})

describe('isMissingPhotoOrLocation', () => {
  it('treats the placeholder avatar as no photo', () => {
    expect(isMissingPhotoOrLocation({ avatarUrl: PLACEHOLDER, location: 'Here' })).toBe(true)
    expect(isMissingPhotoOrLocation({ avatarUrl: 'https://example.com/me.png', location: '' })).toBe(true)
    expect(isMissingPhotoOrLocation({ avatarUrl: 'https://example.com/me.png', location: 'Here' })).toBe(false)
  })
})
