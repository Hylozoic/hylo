import React from 'react'
import { graphql, HttpResponse } from 'msw'
import { Route, Routes, useLocation, useParams } from 'react-router-dom'
import mockGraphqlServer from 'util/testing/mockGraphqlServer'
import { AllTheProviders, render, screen } from 'util/testing/reactTestingLibraryExtended'
import trackAnalyticsEvent from 'store/actions/trackAnalyticsEvent'
import PublicPostDetail from './PublicPostDetail'

jest.mock('routes/PostDetail', () => () => <div>Post detail</div>)
jest.mock('store/actions/trackAnalyticsEvent', () => jest.fn(() => ({ type: 'TRACK_ANALYTICS_EVENT' })))

function mockPostPublic (post) {
  mockGraphqlServer.use(
    graphql.query('CheckIsPostPublic', () => HttpResponse.json({ data: { post } }))
  )
}

function renderPublicPostDetail () {
  return render(
    <Routes>
      <Route path='/post/1' element={<PublicPostDetail />} />
      <Route path='/login' element={<div>Login page</div>} />
    </Routes>,
    { wrapper: AllTheProviders({}, ['/post/1']) }
  )
}

beforeEach(() => {
  useParams.mockReturnValue({ postId: '1' })
  useLocation.mockReturnValue({ pathname: '/post/1', search: '' })
})

afterEach(() => {
  trackAnalyticsEvent.mockClear()
  useParams.mockReturnValue({})
  useLocation.mockReturnValue({ pathname: '', search: '' })
})

it('tracks Login Wall Hit before sending a signed-out user to login for a non-public post', async () => {
  mockPostPublic(null)

  renderPublicPostDetail()

  expect(await screen.findByText('Login page')).toBeInTheDocument()
  expect(trackAnalyticsEvent).toHaveBeenCalledWith('Login Wall Hit', { kind: 'post' })
})

it('shows a public post without tracking a login wall', async () => {
  mockPostPublic({ id: '1' })

  renderPublicPostDetail()

  expect(await screen.findByText('Post detail')).toBeInTheDocument()
  expect(trackAnalyticsEvent).not.toHaveBeenCalled()
})

function mockPostTeaser (postTeaser) {
  mockGraphqlServer.use(
    graphql.query('PostTeaser', () => HttpResponse.json({ data: { postTeaser } }))
  )
}

it('shows the private-group page, without naming a group, for a members-only post', async () => {
  mockPostPublic(null)
  mockPostTeaser({ exists: true, group: null })

  renderPublicPostDetail()

  expect(await screen.findByText('This post is in a private group')).toBeInTheDocument()
  expect(screen.queryByText('Login page')).not.toBeInTheDocument()
  expect(trackAnalyticsEvent).toHaveBeenCalledWith('Login Wall Hit', { kind: 'post_teaser_private' })
})

it('shows the group teaser when the post is in a group with a public About page', async () => {
  mockPostPublic(null)
  mockPostTeaser({ exists: true, group: { name: 'Open Garden', slug: 'open-garden', avatarUrl: null } })

  renderPublicPostDetail()

  expect(await screen.findByText('This post is in Open Garden')).toBeInTheDocument()
  expect(trackAnalyticsEvent).toHaveBeenCalledWith('Login Wall Hit', { kind: 'post_teaser_group' })
})

it('still sends a signed-out user to login when the post does not exist', async () => {
  mockPostPublic(null)
  mockPostTeaser({ exists: false, group: null })

  renderPublicPostDetail()

  expect(await screen.findByText('Login page')).toBeInTheDocument()
  expect(trackAnalyticsEvent).toHaveBeenCalledWith('Login Wall Hit', { kind: 'post' })
})
