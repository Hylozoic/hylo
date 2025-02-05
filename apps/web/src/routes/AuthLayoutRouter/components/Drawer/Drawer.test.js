import React from 'react'
import orm from 'store/models'
import extractModelsForTest from 'util/testing/extractModelsForTest'
import { AllTheProviders, render, screen } from 'util/testing/reactTestingLibraryExtended'
import Drawer, { ContextRow } from './Drawer'

const fooGroup = {
  id: '11',
  slug: 'foo',
  name: 'Foomunity',
  avatarUrl: '/foo.png',
  newPostCount: 0
}

const barGroup = {
  id: '22',
  slug: 'bar',
  name: 'Barmunity',
  avatarUrl: '/bar.png',
  newPostCount: 7
}

function currentUserWithGroupsProvider () {
  const ormSession = orm.mutableSession(orm.getEmptyState())
  const reduxState = { orm: ormSession.state }

  extractModelsForTest({
    me: {
      id: '1',
      name: 'Test User',
      hasRegistered: true,
      emailValidated: true,
      settings: {
        signupInProgress: false
      },
      memberships: [
        {
          id: '2',
          person: {
            id: '1'
          },
          newPostCount: 0,
          group: fooGroup
        },
        {
          id: '3',
          person: {
            id: '1'
          },
          newPostCount: 7,
          group: barGroup
        }
      ]
    }
  }, 'Me', ormSession)

  return AllTheProviders(reduxState)
}

const match = {
  match: {
    params: {
      context: 'groups',
      groupSlug: 'slug'
    }
  }
}

it('shows groups for current user', () => {
  render(
    <Drawer match={match} />,
    { wrapper: currentUserWithGroupsProvider() }
  )

  expect(screen.getByText(fooGroup.name)).toBeInTheDocument()
  expect(screen.getByText(barGroup.name)).toBeInTheDocument()
})

describe('ContextRow', () => {
  it('renders with zero new posts', () => {
    render(<ContextRow group={fooGroup} />)

    expect(screen.getByText(fooGroup.name)).toBeInTheDocument()
    expect(screen.queryByRole('status')).not.toBeInTheDocument() // Assuming Badge is rendered with role="status"
  })

  it('renders with new posts', () => {
    render(<ContextRow group={barGroup} />)

    expect(screen.getByText(barGroup.name)).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent('7') // Assuming Badge is rendered with role="status"
  })
})
