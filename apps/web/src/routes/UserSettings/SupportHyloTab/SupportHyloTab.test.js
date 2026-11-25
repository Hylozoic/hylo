import React from 'react'
import { graphql, HttpResponse } from 'msw'
import mockGraphqlServer from 'util/testing/mockGraphqlServer'
import { render, screen, waitFor, fireEvent } from 'util/testing/reactTestingLibraryExtended'
import SupportHyloTab from './SupportHyloTab'

const baseInfo = {
  checkAvailable: true,
  supporterStatus: 'supporter',
  showSupporterBadge: false,
  hasIncognitoContributions: false,
  manualGrant: false,
  manualGrantExpiresAt: null,
  contributions: [
    { id: '11', frequency: 'MONTHLY', status: 'ACTIVE', createdAt: '2026-01-05T00:00:00Z', lastChargedAt: null, isIncognito: false, qualifies: true, group: null }
  ],
  adminGroups: [{ id: '7', name: 'Garden Club', slug: 'garden', avatarUrl: null }]
}

function mockInfo (info) {
  mockGraphqlServer.use(
    graphql.query('SupportHylo', () => HttpResponse.json({ data: { supportHylo: info } }))
  )
}

describe('SupportHyloTab', () => {
  it('turns the badge on and off with the opt-in switch', async () => {
    const calls = []
    mockInfo(baseInfo)
    mockGraphqlServer.use(
      graphql.mutation('SetSupporterBadgeVisibility', ({ variables }) => {
        calls.push(variables)
        return HttpResponse.json({ data: { setSupporterBadgeVisibility: true } })
      })
    )
    render(<SupportHyloTab />)

    expect(await screen.findByText('You are a Hylo supporter')).toBeInTheDocument()
    const toggle = screen.getByTestId('show-supporter-badge')
    expect(toggle).toHaveAttribute('aria-checked', 'false')

    fireEvent.click(toggle)
    await waitFor(() => expect(calls).toEqual([{ groupId: null, show: true }]))
    expect(toggle).toHaveAttribute('aria-checked', 'true')
    expect(screen.getByTestId('supporter-badge')).toBeInTheDocument()

    fireEvent.click(toggle)
    await waitFor(() => expect(calls[1]).toEqual({ groupId: null, show: false }))
    expect(screen.queryByTestId('supporter-badge')).not.toBeInTheDocument()
  })

  it('says the check is not available yet when Open Collective is not configured', async () => {
    mockInfo({ ...baseInfo, checkAvailable: false, supporterStatus: 'none', contributions: [] })
    render(<SupportHyloTab />)
    expect(await screen.findByTestId('support-check-unavailable')).toHaveTextContent("Checking Open Collective contributions isn't available yet.")
    expect(screen.getByTestId('check-open-collective')).toBeDisabled()
  })

  it('checks Open Collective and reports what it found', async () => {
    mockInfo({ ...baseInfo, supporterStatus: 'none', contributions: [] })
    mockGraphqlServer.use(
      graphql.mutation('CheckOpenCollectiveContributions', () => HttpResponse.json({
        data: { checkOpenCollectiveContributions: { found: false, linkedCount: 0, linkedElsewhere: false, supporterStatus: 'none' } }
      }))
    )
    render(<SupportHyloTab />)
    fireEvent.click(await screen.findByTestId('check-open-collective'))
    expect(await screen.findByTestId('support-check-result')).toHaveTextContent("We couldn't find any contributions to Hylo made with your email address.")
  })

  it('explains an unverified email', async () => {
    mockInfo({ ...baseInfo, supporterStatus: 'none', contributions: [] })
    mockGraphqlServer.use(
      graphql.mutation('CheckOpenCollectiveContributions', () => HttpResponse.json({
        errors: [{ message: 'Verify your email address first', extensions: { code: 'EMAIL_NOT_VERIFIED' } }]
      }))
    )
    render(<SupportHyloTab />)
    fireEvent.click(await screen.findByTestId('check-open-collective'))
    expect(await screen.findByTestId('support-check-result')).toHaveTextContent('Please verify your email address first, then check again.')
  })

  it('lets you count a contribution for a group you administer', async () => {
    const calls = []
    mockInfo(baseInfo)
    mockGraphqlServer.use(
      graphql.mutation('AttributeSupportContribution', ({ variables }) => {
        calls.push(variables)
        return HttpResponse.json({ data: { attributeSupportContribution: { id: '11', group: { id: '7', name: 'Garden Club' } } } })
      })
    )
    render(<SupportHyloTab />)
    const select = await screen.findByLabelText('Also counts for')
    fireEvent.change(select, { target: { value: '7' } })
    await waitFor(() => expect(calls).toEqual([{ contributionId: '11', groupId: '7' }]))
  })

  it('shows staff grants and the incognito note', async () => {
    mockInfo({ ...baseInfo, manualGrant: true, manualGrantExpiresAt: null, hasIncognitoContributions: true })
    render(<SupportHyloTab />)
    expect(await screen.findByTestId('support-manual-grant')).toHaveTextContent('The Hylo team has recognised your contribution to Hylo.')
    expect(screen.getByTestId('support-incognito-note')).toBeInTheDocument()
  })
})
