import React from 'react'
import { render, screen } from 'util/testing/reactTestingLibraryExtended'
import { ActivePeople } from './MetricsPanel'

const t = text => text

/** One chart point. */
function point (periodStart, value) {
  return { periodStart, value, previous: null, previousStart: null }
}

describe('ActivePeople', () => {
  it('shows daily, weekly and monthly people who opened Hylo', () => {
    render(
      <ActivePeople
        t={t}
        daily={[point('2026-11-09', 4), point('2026-11-10', 5)]}
        weekly={[point('2026-11-09', 12), point('2026-11-10', 14)]}
        monthly={[point('2026-11-09', 40), point('2026-11-10', 42)]}
      />
    )
    expect(screen.getByText('Daily active people').parentElement).toHaveTextContent('5')
    expect(screen.getByText('Weekly active people').parentElement).toHaveTextContent('14')
    expect(screen.getByText('Monthly active people').parentElement).toHaveTextContent('42')
    expect(screen.getByText('Anyone who opened Hylo, even just to look. Daily is that day. Weekly is the last 7 days. Monthly is the last 30 days.')).toBeInTheDocument()
  })

  it('uses the group wording when the chart is for one group', () => {
    render(
      <ActivePeople
        t={t}
        group
        daily={[point('2026-11-10', 2)]}
        weekly={[point('2026-11-10', 3)]}
        monthly={[point('2026-11-10', 4)]}
      />
    )
    expect(screen.getByText('Anyone who opened this group, even just to look. Daily is that day. Weekly is the last 7 days. Monthly is the last 30 days.')).toBeInTheDocument()
  })

  it('renders nothing when nobody was active', () => {
    render(<ActivePeople t={t} daily={[]} weekly={[]} monthly={[]} />)
    expect(screen.queryByTestId('active-audience')).not.toBeInTheDocument()
  })
})
