import React from 'react'
import { AllTheProviders, render, screen } from 'util/testing/reactTestingLibraryExtended'
import ViewHeader from './ViewHeader'

jest.mock('hooks/useMobileNavBack', () => () => ({
  performBack: () => {},
  headerDetails: { title: 'All' },
  location: { pathname: '/groups/parent/spaces/space/all', search: '' },
  group: { slug: 'parent' },
  currentUser: null,
  groupSlug: 'parent',
  spaceSlug: 'space',
  context: 'groups',
  isOneColumnGroup: false,
  isOneColumnContext: false,
  oneColumn: false,
  isSingleViewSpace: false,
  presentedSpaceView: {
    type: 'space',
    name: 'Test Space',
    linkedGroup: { id: 'space-id', name: 'Test Space', slug: 'parent-space', type: 'space' }
  },
  isSpaceMember: true,
  spaceMembership: { group: { id: 'space-id' }, navOrder: null }
}))

describe('ViewHeader space navigation pin', () => {
  it('places the member pin control beside the About control in the main-column header', () => {
    render(<ViewHeader />, { wrapper: AllTheProviders() })

    expect(screen.getByRole('button', { name: 'About' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Pin space to global navigation' })).toBeInTheDocument()
  })
})
