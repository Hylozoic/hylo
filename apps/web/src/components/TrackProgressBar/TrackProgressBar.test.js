import React from 'react'
import { render, screen } from 'util/testing/reactTestingLibraryExtended'
import TrackProgressBar from './TrackProgressBar'

describe('TrackProgressBar', () => {
  it('shows how many actions are done', () => {
    render(<TrackProgressBar completed={2} total={5} />)
    expect(screen.getByText('2 of 5 completed')).toBeInTheDocument()
    const bar = screen.getByRole('progressbar')
    expect(bar).toHaveAttribute('aria-valuenow', '2')
    expect(bar).toHaveAttribute('aria-valuemax', '5')
  })

  it('shows nothing for a track without actions', () => {
    render(<TrackProgressBar completed={0} total={0} />)
    expect(screen.queryByTestId('track-progress')).not.toBeInTheDocument()
  })
})
