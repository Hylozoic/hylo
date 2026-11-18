import React from 'react'
import { render, screen } from 'util/testing/reactTestingLibraryExtended'
import SupporterBadge from './SupporterBadge'

describe('SupporterBadge', () => {
  it('shows a supporter label without any amount', () => {
    render(<SupporterBadge />)
    const badge = screen.getByTestId('supporter-badge')
    expect(badge).toHaveTextContent('Hylo Supporter')
    expect(badge).toHaveAttribute('title', 'Supports Hylo, the nonprofit platform for communities')
    expect(badge.textContent).not.toMatch(/\$|\d/)
  })

  it('uses group wording for groups', () => {
    render(<SupporterBadge group />)
    expect(screen.getByTestId('supporter-badge')).toHaveAttribute('title', 'This group supports Hylo, the nonprofit platform it runs on')
  })
})
