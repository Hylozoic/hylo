import React from 'react'
import { graphql, HttpResponse } from 'msw'
import { AllTheProviders, render, screen, waitFor } from 'util/testing/reactTestingLibraryExtended'
import mockGraphqlServer from 'util/testing/mockGraphqlServer'
import orm from 'store/models'
import extractModelsForTest from 'util/testing/extractModelsForTest'
import GroupAboutView from './GroupAboutView'

const testGroup = {
  id: '1',
  name: 'Test Group',
  slug: 'test-group',
  settings: {}
}

function providersWithMembership (settings) {
  const ormSession = orm.mutableSession(orm.getEmptyState())
  extractModelsForTest({
    me: {
      id: '1',
      memberships: {
        items: [{ id: '10', person: { id: '1' }, settings, group: testGroup }]
      }
    }
  }, 'Me', ormSession)
  extractModelsForTest({ groups: [testGroup] }, 'Group', ormSession)
  return AllTheProviders({ orm: ormSession.state })
}

beforeEach(() => {
  mockGraphqlServer.use(
    graphql.query('EmailUnsubscribeScope', () => HttpResponse.json({
      data: { me: { id: '1', settings: { emailUnsubscribeScope: null } } }
    })),
    graphql.query(/.*/, () => HttpResponse.json({ data: {} }))
  )
})

describe('GroupAboutView notification settings tab', () => {
  it('says when email from the group is off, with a link to change it (D11)', async () => {
    const settings = { sendEmail: false, sendPushNotifications: true, postNotifications: 'important', digestFrequency: 'daily' }
    render(
      <GroupAboutView group={testGroup} tab='notifications' onTabChange={() => {}} />,
      {},
      providersWithMembership(settings)
    )

    await waitFor(() => expect(screen.getByTestId('email-off-notice')).toHaveTextContent('Email from this group is off.'))
    expect(screen.getByRole('link', { name: 'Change email settings' })).toHaveAttribute('href', '/my/notifications')
  })

  it('says nothing while email from the group is on', async () => {
    const settings = { sendEmail: true, sendPushNotifications: true, postNotifications: 'important', digestFrequency: 'daily' }
    render(
      <GroupAboutView group={testGroup} tab='notifications' onTabChange={() => {}} />,
      {},
      providersWithMembership(settings)
    )

    await screen.findByText('Notification Settings for Test Group')
    await new Promise(resolve => setTimeout(resolve, 50))
    expect(screen.queryByTestId('email-off-notice')).toBeNull()
  })
})
