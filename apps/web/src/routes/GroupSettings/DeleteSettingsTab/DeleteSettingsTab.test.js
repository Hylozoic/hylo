import React from 'react'
import { graphql, HttpResponse } from 'msw'
import { fireEvent, render, screen, waitFor, within } from 'util/testing/reactTestingLibraryExtended'
import mockGraphqlServer from 'util/testing/mockGraphqlServer'
import trackAnalyticsEvent from 'store/actions/trackAnalyticsEvent'
import DeleteSettingsTab from './DeleteSettingsTab'

jest.mock('store/actions/trackAnalyticsEvent', () => {
  const actual = jest.requireActual('store/actions/trackAnalyticsEvent')
  return { __esModule: true, default: jest.fn(actual.default) }
})

const group = { id: '1', name: 'Seed Library', slug: 'seed-library' }

function mockGroup ({ memberCount = 4, status = 'published' } = {}) {
  const calls = { deleteGroup: [], archive: [] }
  mockGraphqlServer.use(
    graphql.query('CloseGroupDetails', () => HttpResponse.json({ data: { group: { id: '1', memberCount, status } } })),
    graphql.mutation('DeleteGroup', ({ variables }) => {
      calls.deleteGroup.push(variables)
      return HttpResponse.json({ data: { deleteGroup: { success: true } } })
    }),
    graphql.mutation('SetGroupArchived', ({ query, variables }) => {
      const archiving = query.includes('archiveGroup(') && !query.includes('unarchiveGroup(')
      calls.archive.push({ archiving, ...variables })
      const field = archiving ? 'archiveGroup' : 'unarchiveGroup'
      return HttpResponse.json({ data: { [field]: { id: '1', status: archiving ? 'archived' : 'published' } } })
    })
  )
  return calls
}

describe('DeleteSettingsTab (Close group)', () => {
  beforeEach(() => {
    trackAnalyticsEvent.mockClear()
  })

  it('offers hand-off, archive and delete, and no longer says deleting cannot be undone', async () => {
    mockGroup()
    render(<DeleteSettingsTab group={group} />)

    expect(screen.getByText('Close Seed Library')).toBeInTheDocument()
    expect(screen.getByTestId('close-group-hand-off')).toHaveTextContent('Hand it to someone else')
    expect(screen.getByTestId('close-group-archive')).toHaveTextContent('Archive it')
    expect(screen.getByTestId('close-group-delete')).toHaveTextContent('Hylo staff can restore it for 30 days')
    expect(screen.queryByText(/cannot be undone/)).not.toBeInTheDocument()
  })

  it('archives the group and opens it again', async () => {
    const calls = mockGroup()
    const confirm = jest.spyOn(window, 'confirm').mockImplementation(() => true)
    render(<DeleteSettingsTab group={group} />)

    fireEvent.click(screen.getByRole('button', { name: 'Archive group' }))
    expect(await screen.findByText('Seed Library is archived.')).toBeInTheDocument()
    expect(calls.archive[0]).toEqual({ archiving: true, groupId: '1' })
    expect(trackAnalyticsEvent).toHaveBeenCalledWith('Group Archived', { groupId: '1' })

    fireEvent.click(screen.getByRole('button', { name: 'Open group again' }))
    expect(await screen.findByText('Seed Library is open again.')).toBeInTheDocument()
    expect(calls.archive[1]).toEqual({ archiving: false, groupId: '1' })
    expect(trackAnalyticsEvent).toHaveBeenCalledWith('Group Unarchived', { groupId: '1' })
    confirm.mockRestore()
  })

  it('deletes a small group after a confirm', async () => {
    const calls = mockGroup({ memberCount: 3 })
    const confirm = jest.spyOn(window, 'confirm').mockImplementation(() => true)
    render(<DeleteSettingsTab group={group} />)

    const button = within(screen.getByTestId('close-group-delete')).getByRole('button', { name: 'Delete Group' })
    await waitFor(() => expect(button).toBeEnabled())
    expect(screen.queryByLabelText('Type Seed Library to confirm')).not.toBeInTheDocument()
    fireEvent.click(button)

    expect(confirm).toHaveBeenCalledWith('Delete Seed Library? Everyone will be removed and emailed. Hylo staff can restore it for 30 days.')
    await waitFor(() => expect(calls.deleteGroup).toHaveLength(1))
    expect(calls.deleteGroup[0]).toEqual({ id: '1' })
    await waitFor(() => expect(trackAnalyticsEvent).toHaveBeenCalledWith('Group Deleted', { groupId: '1', memberCount: 3 }))
    confirm.mockRestore()
  })

  it("asks a larger group's steward to type its name before deleting", async () => {
    const calls = mockGroup({ memberCount: 25 })
    render(<DeleteSettingsTab group={group} />)

    const section = screen.getByTestId('close-group-delete')
    const input = await within(section).findByLabelText('Type Seed Library to confirm')
    const button = within(section).getByRole('button', { name: 'Delete Group' })
    expect(button).toBeDisabled()

    fireEvent.change(input, { target: { value: 'Seed' } })
    expect(button).toBeDisabled()
    fireEvent.change(input, { target: { value: ' seed library ' } })
    expect(button).toBeEnabled()
    fireEvent.click(button)

    await waitFor(() => expect(calls.deleteGroup).toHaveLength(1))
    expect(calls.deleteGroup[0]).toEqual({ id: '1', confirmName: ' seed library ' })
  })
})
