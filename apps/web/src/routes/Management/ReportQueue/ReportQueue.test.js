import React from 'react'
import { delay, graphql, HttpResponse } from 'msw'
import mockGraphqlServer from 'util/testing/mockGraphqlServer'
import { render, screen, fireEvent, waitFor } from 'util/testing/reactTestingLibraryExtended'
import ReportQueue from './ReportQueue'

const report = {
  id: '9',
  category: 'abusive',
  text: 'Kept messaging after I asked them to stop',
  status: 'active',
  createdAt: '2026-09-01T10:00:00.000Z',
  resolvedAt: null,
  messageThreadId: '44',
  reporter: { id: '1', name: 'Reporter Person', avatarUrl: '' },
  reportedUser: { id: '2', name: 'Reported Person', avatarUrl: '' },
  threadParticipants: [{ id: '1', name: 'Reporter Person' }, { id: '2', name: 'Reported Person' }],
  resolvedBy: null
}

describe('ReportQueue', () => {
  it('lists open staff reports and resolves one', async () => {
    let resolvedId = null
    mockGraphqlServer.use(
      graphql.query('StaffReports', () => HttpResponse.json({
        data: { staffReports: { total: 1, hasMore: false, items: [report] } }
      })),
      graphql.mutation('ResolveStaffReport', ({ variables }) => {
        resolvedId = variables.id
        return HttpResponse.json({ data: { resolveStaffReport: { success: true } } })
      })
    )

    render(<ReportQueue />)

    expect(await screen.findByText('Kept messaging after I asked them to stop')).toBeInTheDocument()
    expect(screen.getByText('Abusive')).toBeInTheDocument()
    expect(screen.getByText('reported a conversation')).toBeInTheDocument()
    // Names open the person's profile
    expect(screen.getAllByRole('link', { name: 'Reported Person' })[0]).toHaveAttribute('href', '/all/members/2')
    expect(screen.getAllByRole('link', { name: 'Reporter Person' })[0]).toHaveAttribute('href', '/all/members/1')

    fireEvent.click(screen.getByTestId('resolve-staff-report'))
    await waitFor(() => expect(resolvedId).toBe('9'))
    await waitFor(() => expect(screen.queryByTestId('staff-report')).not.toBeInTheDocument())
  })

  it('says when there are no open reports', async () => {
    mockGraphqlServer.use(
      graphql.query('StaffReports', () => HttpResponse.json({
        data: { staffReports: { total: 0, hasMore: false, items: [] } }
      }))
    )
    render(<ReportQueue />)
    expect(await screen.findByText('No open reports')).toBeInTheDocument()
  })

  it('keeps the newest tab when an older request answers late', async () => {
    mockGraphqlServer.use(
      graphql.query('StaffReports', async ({ variables }) => {
        if (variables.status === 'active') {
          await delay(150)
          return HttpResponse.json({ data: { staffReports: { total: 1, hasMore: false, items: [report] } } })
        }
        return HttpResponse.json({
          data: { staffReports: { total: 1, hasMore: false, items: [{ ...report, id: '10', text: 'Already handled', status: 'resolved', resolvedBy: { id: '5', name: 'Staff' } }] } }
        })
      })
    )
    render(<ReportQueue />)
    fireEvent.click(screen.getByRole('tab', { name: 'Resolved' }))

    expect(await screen.findByText('Already handled')).toBeInTheDocument()
    await new Promise(resolve => setTimeout(resolve, 250))
    expect(screen.queryByText('Kept messaging after I asked them to stop')).not.toBeInTheDocument()
    expect(screen.getAllByTestId('staff-report')).toHaveLength(1)
  })
})
