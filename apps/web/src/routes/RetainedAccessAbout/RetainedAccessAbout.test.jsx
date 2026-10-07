import React from 'react'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AllTheProviders, render } from 'util/testing/reactTestingLibraryExtended'
import fetchRetainedAccessAbout from 'store/actions/fetchRetainedAccessAbout'
import rejoinGroup from 'store/actions/rejoinGroup'
import RetainedAccessAbout from './RetainedAccessAbout'

const mockNavigate = jest.fn()

jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate
}))
jest.mock('store/actions/fetchRetainedAccessAbout', () => jest.fn())
jest.mock('store/actions/rejoinGroup', () => jest.fn(() => ({ type: 'RejoinGroup/REJOIN_GROUP' })))

const groupAbout = {
  id: '5',
  name: 'Paid Group',
  slug: 'paid-group',
  type: null,
  hasActiveParentMembership: true,
  homeRoute: '/all'
}

function renderAbout (about, path) {
  fetchRetainedAccessAbout.mockReturnValue({
    type: 'RetainedAccessAbout/FETCH',
    payload: { data: { retainedAccessAbout: about } }
  })
  return render(
    <RetainedAccessAbout slug={about.slug} />,
    null,
    AllTheProviders({}, [path])
  )
}

afterEach(() => {
  fetchRetainedAccessAbout.mockReset()
  rejoinGroup.mockClear()
  mockNavigate.mockClear()
})

describe('RetainedAccessAbout', () => {
  it('redirects to the group home only after the rejoin request resolves', async () => {
    renderAbout(groupAbout, '/groups/paid-group/about')

    expect(await screen.findByText('You are not currently a member of Paid Group, but your access is still valid. Rejoin to participate again.')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Rejoin Paid Group' }))

    await waitFor(() => {
      expect(rejoinGroup).toHaveBeenCalledWith('5')
      expect(mockNavigate).toHaveBeenCalledWith('/groups/paid-group/all')
    })
  })

  it('requires parent membership before showing a retained-space rejoin action', async () => {
    const spaceAbout = {
      ...groupAbout,
      id: '6',
      name: 'Paid Space',
      slug: 'parent-paid-space',
      type: 'space',
      hasActiveParentMembership: false,
      parentGroupName: 'Parent Group',
      parentGroupSlug: 'parent-group'
    }

    renderAbout(spaceAbout, '/groups/parent-group/spaces/paid-space/about')

    expect(await screen.findByText('To rejoin this space, you need to be a member of its parent group first.')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Go to Parent Group about page' })).toHaveAttribute('href', '/groups/parent-group/about')
    expect(screen.queryByRole('button', { name: 'Rejoin Paid Space' })).not.toBeInTheDocument()
  })
})
