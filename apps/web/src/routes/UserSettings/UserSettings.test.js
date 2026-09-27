import React from 'react'
import { Route, Routes } from 'react-router-dom'
import { AllTheProviders, render, screen } from 'util/testing/reactTestingLibraryExtended'
import mockGraphqlServer from 'util/testing/mockGraphqlServer'
import { graphql, HttpResponse } from 'msw'
import orm from 'store/models'
import UserSettings from './UserSettings'

describe('UserSettings', () => {
  let reduxState

  beforeAll(() => {
    const ormSession = orm.session(orm.getEmptyState())

    ormSession.Person.create({
      id: '2',
      name: 'a user'
    })
    ormSession.Me.create({
      id: '1',
      hasFeature: () => true,
      blockedUsers: ['2'],
      settings: {}
    })
    const group = ormSession.Group.create({
      id: '1',
      name: 'Wombats',
      slug: 'wombats'
    })
    ormSession.Membership.create({
      id: '2',
      settings: {},
      person: '1',
      group
    })

    reduxState = {
      orm: ormSession.state,
      FullPageModal: { confirm: false },
      pending: { FETCH_FOR_CURRENT_USER: false }
    }
  })

  beforeEach(() => {
    mockGraphqlServer.use(
      graphql.query('UserSettingsQuery', () => {
        return HttpResponse.json({
          data: {
            me: {
              id: '1',
              rsvpCalendarUrl: null,
              affiliations: { items: [] },
              blockedUsers: [{ id: '2', name: 'a user' }],
              memberships: []
            }
          }
        })
      }),
      graphql.query('MemberSkills', () => {
        return HttpResponse.json({
          data: {
            person: {
              id: '1',
              skills: { items: [] }
            }
          }
        })
      }),
      graphql.query('MemberSkillsToLearn', () => {
        return HttpResponse.json({
          data: {
            person: {
              id: '1',
              skills: { items: [] }
            }
          }
        })
      })
    )
  })

  it('renders without crashing', () => {
    const { container } = render(
      <UserSettings />,
      { wrapper: AllTheProviders(reduxState) }
    )

    expect(container.querySelector('#root') || container).toBeTruthy()
  })

  it('redirects the subscriptions path that emails link to over to my transactions', async () => {
    render(
      <Routes>
        <Route path='my/transactions' element={<div>My transactions page</div>} />
        <Route path='*' element={<UserSettings />} />
      </Routes>,
      { wrapper: AllTheProviders(reduxState, ['/subscriptions']) }
    )

    expect(await screen.findByText('My transactions page')).toBeInTheDocument()
  })
})
