import React from 'react'
import { graphql, HttpResponse } from 'msw'
import orm from 'store/models'
import { AllTheProviders, render, screen, waitFor, act } from 'util/testing/reactTestingLibraryExtended'
import mockGraphqlServer from 'util/testing/mockGraphqlServer'
import TrackProgressPanel from './TrackProgressPanel'

const mockNavigate = jest.fn()
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate
}))

const learner = (id, extra = {}) => ({
  id: String(id),
  name: `Learner ${id}`,
  avatarUrl: null,
  enrolledAt: '2026-09-01T00:00:00.000Z',
  completedAt: null,
  actionsCompleted: 0,
  lastActionAt: null,
  ...extra
})

describe('TrackProgressPanel', () => {
  let requests

  const serve = learnersFor => {
    requests = []
    mockGraphqlServer.use(
      graphql.query('FetchTrackLearnerProgress', ({ variables }) => {
        requests.push(variables)
        const items = learnersFor(variables)
        return HttpResponse.json({
          data: { track: { id: '7', numActions: 3, enrolledUsers: { total: items.length, items } } }
        })
      })
    )
  }

  const renderPanel = () => {
    const session = orm.session(orm.getEmptyState())
    session.Me.create({ id: '1', name: 'Steward' })
    render(<TrackProgressPanel trackId='7' />, { wrapper: AllTheProviders({ orm: session.state, pending: {} }) })
  }

  beforeEach(() => mockNavigate.mockClear())

  it('lists learners who have not finished, with N of M and their last action', async () => {
    serve(() => [
      learner(2, { actionsCompleted: 1, lastActionAt: '2026-09-20T12:00:00.000Z' }),
      learner(3)
    ])
    renderPanel()

    await waitFor(() => expect(screen.getByText('Learner 2')).toBeInTheDocument())
    expect(requests[0]).toMatchObject({ id: '7', completed: false })
    expect(screen.getByText('1 of 3 completed')).toBeInTheDocument()
    expect(screen.getByText('0 of 3 completed')).toBeInTheDocument()
    expect(screen.getByText(/^Last action /)).toBeInTheDocument()
    expect(screen.getByText('No actions yet')).toBeInTheDocument()
  })

  it('shows everyone when asked, finished learners as all done', async () => {
    serve(({ completed }) => completed === false
      ? [learner(3)]
      : [learner(2, { completedAt: '2026-09-21T12:00:00.000Z', actionsCompleted: 3 }), learner(3)])
    renderPanel()
    await waitFor(() => expect(screen.getByText('Learner 3')).toBeInTheDocument())

    await act(async () => { screen.getByRole('button', { name: 'Everyone' }).click() })
    await waitFor(() => expect(screen.getByText('Learner 2')).toBeInTheDocument())
    expect(requests[1].completed).toBe(null)
    expect(screen.getByText('3 of 3 completed')).toBeInTheDocument()
    expect(screen.queryByTestId('message-not-finished')).not.toBeInTheDocument()
  })

  it('starts a group message with the learners who have not finished, within the limit', async () => {
    serve(() => Array.from({ length: 25 }, (_, i) => learner(i + 1)))
    renderPanel()
    await waitFor(() => expect(screen.getByTestId('message-not-finished')).toBeInTheDocument())
    expect(screen.getByText('Group messages are limited to 20 people')).toBeInTheDocument()

    await act(async () => { screen.getByTestId('message-not-finished').click() })
    const [url] = mockNavigate.mock.calls[0]
    const ids = new URL(url, 'http://localhost').searchParams.get('participants').split(',')
    expect(url.startsWith('/messages/new?participants=')).toBe(true)
    expect(ids).toHaveLength(19)
    expect(ids).not.toContain('1')
  })
})
