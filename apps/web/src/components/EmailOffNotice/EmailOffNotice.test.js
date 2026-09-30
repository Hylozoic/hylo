import React from 'react'
import { graphql, HttpResponse } from 'msw'
import { render, screen, waitFor } from 'util/testing/reactTestingLibraryExtended'
import mockGraphqlServer from 'util/testing/mockGraphqlServer'
import EmailOffNotice from './EmailOffNotice'
import { emailOffState } from './EmailOffNotice.store'

const answerScope = emailUnsubscribeScope => mockGraphqlServer.use(
  graphql.query('EmailUnsubscribeScope', () => HttpResponse.json({
    data: { me: { id: '1', settings: { emailUnsubscribeScope } } }
  }))
)

describe('emailOffState', () => {
  it('is off when the group sends no email or a saved choice stops group email', () => {
    expect(emailOffState({ sendEmail: false }, null)).toBe('off')
    expect(emailOffState({ sendEmail: true }, 'no_group_emails')).toBe('off')
    expect(emailOffState({ sendEmail: true }, 'everything')).toBe('off')
  })

  it("keeps mentions and replies under 'everything except direct'", () => {
    expect(emailOffState({ sendEmail: true }, 'all_but_direct')).toBe('onlyDirect')
  })

  it('says nothing while email is on', () => {
    expect(emailOffState({ sendEmail: true }, null)).toBeNull()
    expect(emailOffState({ sendEmail: true }, 'digest_only')).toBeNull()
  })
})

describe('EmailOffNotice', () => {
  it('says email is off for the group, with a link to change it', async () => {
    render(<EmailOffNotice membershipSettings={{ sendEmail: false }} />)
    expect(screen.getByText('Email from this group is off.', { exact: false })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Change email settings' })).toHaveAttribute('href', '/my/notifications')
  })

  it("names mentions and replies for someone who chose 'everything except direct'", async () => {
    answerScope('all_but_direct')
    render(<EmailOffNotice membershipSettings={{ sendEmail: true }} />)
    await waitFor(() => expect(screen.getByText('Email from this group is off, except mentions and replies to you.', { exact: false })).toBeInTheDocument())
  })

  it('shows nothing while email is on', async () => {
    answerScope(null)
    const { container } = render(<EmailOffNotice membershipSettings={{ sendEmail: true }} />)
    await new Promise(resolve => setTimeout(resolve, 50))
    expect(container.querySelector('[data-testid="email-off-notice"]')).toBeNull()
  })
})
