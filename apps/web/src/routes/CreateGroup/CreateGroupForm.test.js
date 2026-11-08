import React, { createRef } from 'react'
import { graphql, HttpResponse } from 'msw'
import trackAnalyticsEvent from 'store/actions/trackAnalyticsEvent'
import orm from 'store/models'
import mockGraphqlServer from 'util/testing/mockGraphqlServer'
import { act, AllTheProviders, fireEvent, render as renderWithProviders, screen, waitFor } from 'util/testing/reactTestingLibraryExtended'
import CreateGroupForm from './CreateGroupForm'

jest.mock('store/actions/trackAnalyticsEvent', () => {
  const actual = jest.requireActual('store/actions/trackAnalyticsEvent')
  return { __esModule: true, default: jest.fn(actual.default) }
})

const WHO_CAN_ADD = 'Who can add new members?'
const STEWARDS = 'Stewards with the Add Members responsibility'
const EVERYONE = 'Everyone in the Group'
const CLOSED_DESCRIPTION = 'Nobody can request to join. Members arrive only when a steward invites them directly or shares an invite link.'

function mockGraphql () {
  const createGroupRequests = []
  mockGraphqlServer.use(
    graphql.operation(({ query, variables }) => {
      if (query.includes('groupExists')) {
        return HttpResponse.json({ data: { groupExists: { exists: false } } })
      }
      if (query.includes('createGroup')) {
        createGroupRequests.push(variables.data)
        return HttpResponse.json({
          data: {
            createGroup: {
              id: '99',
              name: variables.data.name,
              slug: variables.data.slug,
              parentGroups: { items: [] },
              groupRoles: { items: [] },
              memberships: { items: [{ id: '500', person: { id: '10' }, settings: {} }] }
            }
          }
        })
      }
      return HttpResponse.json({ data: {} })
    })
  )
  return createGroupRequests
}

function render (ui, me = {}) {
  const session = orm.mutableSession(orm.getEmptyState())
  session.Me.create({ id: '10', name: 'Founder', groupRoles: { items: [] }, ...me })
  return renderWithProviders(ui, null, AllTheProviders({ orm: session.state }))
}

function choose (settingLabel, optionTitle) {
  fireEvent.click(screen.getByRole('button', { name: settingLabel }))
  fireEvent.click(screen.getByRole('button', { name: optionTitle }))
}

async function createNamedGroup () {
  fireEvent.change(screen.getByPlaceholderText('Name your group'), { target: { value: 'Seed Library' } })
  const submit = screen.getByRole('button', { name: /Create Group/ })
  await waitFor(() => expect(submit).toBeEnabled())
  fireEvent.click(submit)
}

describe('CreateGroupForm "Who can add new members?"', () => {
  beforeEach(() => {
    trackAnalyticsEvent.mockClear()
  })

  it('starts on stewards and offers everyone', () => {
    mockGraphql()
    render(<CreateGroupForm />)

    expect(screen.getByText(WHO_CAN_ADD)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: WHO_CAN_ADD })).toHaveTextContent(STEWARDS)

    fireEvent.click(screen.getByRole('button', { name: WHO_CAN_ADD }))
    expect(screen.getByRole('button', { name: EVERYONE })).toBeInTheDocument()
  })

  it('sends stewards by default', async () => {
    const requests = mockGraphql()
    render(<CreateGroupForm />)

    await createNamedGroup()

    await waitFor(() => expect(requests).toHaveLength(1))
    expect(requests[0].invitePolicy).toEqual('stewards')
    await waitFor(() => expect(trackAnalyticsEvent).toHaveBeenCalledWith('Group Invite Policy Set', { mode: 'stewards', surface: 'create' }))
  })

  it('sends everyone', async () => {
    const requests = mockGraphql()
    render(<CreateGroupForm />)

    choose(WHO_CAN_ADD, EVERYONE)
    await createNamedGroup()

    await waitFor(() => expect(requests).toHaveLength(1))
    expect(requests[0].invitePolicy).toEqual('everyone')
    await waitFor(() => expect(trackAnalyticsEvent).toHaveBeenCalledWith('Group Invite Policy Set', { mode: 'everyone', surface: 'create' }))
  })

  it('counts a changed policy as entered data', () => {
    mockGraphql()
    const ref = createRef()
    const onClose = jest.fn()
    render(<CreateGroupForm ref={ref} onClose={onClose} />)

    choose(WHO_CAN_ADD, EVERYONE)
    act(() => ref.current.requestClose())

    expect(onClose).not.toHaveBeenCalled()
    expect(screen.getByText('Discard this group?')).toBeInTheDocument()
  })

  it('closes without asking when nothing was entered', () => {
    mockGraphql()
    const ref = createRef()
    const onClose = jest.fn()
    render(<CreateGroupForm ref={ref} onClose={onClose} />)

    act(() => ref.current.requestClose())

    expect(onClose).toHaveBeenCalled()
  })

  it('describes Closed groups as invitation only', () => {
    mockGraphql()
    render(<CreateGroupForm />)

    choose('Who can join this group?', 'By invitation only')

    expect(screen.getByText(CLOSED_DESCRIPTION)).toBeInTheDocument()
  })
})
