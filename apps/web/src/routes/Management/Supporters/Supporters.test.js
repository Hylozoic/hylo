import React from 'react'
import { graphql, HttpResponse } from 'msw'
import mockGraphqlServer from 'util/testing/mockGraphqlServer'
import { render, screen, waitFor, fireEvent, within } from 'util/testing/reactTestingLibraryExtended'
import Supporters from './Supporters'

const grant = {
  id: '3',
  note: 'Translated Hylo',
  expiresAt: null,
  createdAt: '2026-11-01T00:00:00Z',
  user: { id: '21', name: 'Ada Lovelace', avatarUrl: null },
  group: null,
  grantedBy: { id: '1', name: 'Staff Person' }
}

describe('Management > Supporters', () => {
  let grants, granted, revoked

  beforeEach(() => {
    grants = [grant]
    granted = []
    revoked = []
    mockGraphqlServer.use(
      graphql.query('SupporterGrants', () => HttpResponse.json({ data: { supporterGrants: grants } })),
      graphql.query('FindPeopleForMentions', () => HttpResponse.json({
        data: { people: { items: [{ id: '42', name: 'Grace Hopper', avatarUrl: null }], total: 1, hasMore: false } }
      })),
      graphql.query('SearchGroupsForSupporterGrant', () => HttpResponse.json({
        data: { groups: { items: [{ id: '9', name: 'Seed Library', slug: 'seeds', avatarUrl: null }] } }
      })),
      graphql.mutation('GrantSupporterStatus', ({ variables }) => {
        granted.push(variables)
        return HttpResponse.json({ data: { grantSupporterStatus: { id: '4' } } })
      }),
      graphql.mutation('RevokeSupporterStatus', ({ variables }) => {
        revoked.push(variables)
        return HttpResponse.json({ data: { revokeSupporterStatus: true } })
      })
    )
  })

  it('lists current grants with who gave them', async () => {
    render(<Supporters />)
    const row = await screen.findByTestId('supporter-grant-row')
    expect(row).toHaveTextContent('Ada Lovelace')
    expect(row).toHaveTextContent('Translated Hylo')
    expect(row).toHaveTextContent('Given by Staff Person')
    expect(row).toHaveTextContent('No expiry')
  })

  it('gives a person supporter status with a note and an expiry date', async () => {
    render(<Supporters />)
    fireEvent.change(screen.getByTestId('supporter-search'), { target: { value: 'Gra' } })
    fireEvent.click(await screen.findByRole('button', { name: /Grace Hopper/ }))
    expect(screen.getByTestId('supporter-selected')).toHaveTextContent('Grace Hopper')

    fireEvent.change(screen.getByTestId('supporter-note'), { target: { value: 'Ran workshops' } })
    fireEvent.change(screen.getByTestId('supporter-expires'), { target: { value: '2027-06-30' } })
    fireEvent.click(screen.getByTestId('supporter-grant'))

    await waitFor(() => expect(granted).toHaveLength(1))
    expect(granted[0]).toMatchObject({ userId: '42', groupId: null, note: 'Ran workshops' })
    expect(new Date(granted[0].expiresAt).getTime()).toBe(new Date('2027-06-30T23:59:59').getTime())
  })

  it('gives a group supporter status', async () => {
    render(<Supporters />)
    fireEvent.click(screen.getByRole('radio', { name: 'A group' }))
    fireEvent.change(screen.getByTestId('supporter-search'), { target: { value: 'Seed' } })
    fireEvent.click(await screen.findByRole('button', { name: /Seed Library/ }))
    fireEvent.click(screen.getByTestId('supporter-grant'))
    await waitFor(() => expect(granted).toEqual([{ userId: null, groupId: '9', note: null, expiresAt: null }]))
  })

  it('revokes a grant after confirming', async () => {
    const confirm = jest.spyOn(window, 'confirm').mockReturnValue(true)
    render(<Supporters />)
    const row = await screen.findByTestId('supporter-grant-row')
    fireEvent.click(within(row).getByRole('button', { name: 'Remove supporter status' }))
    await waitFor(() => expect(revoked).toEqual([{ id: '3' }]))
    await waitFor(() => expect(screen.queryByTestId('supporter-grant-row')).not.toBeInTheDocument())
    confirm.mockRestore()
  })
})
