import React from 'react'
import userEvent from '@testing-library/user-event'
import orm from 'store/models'
import { AllTheProviders, render, screen } from 'util/testing/reactTestingLibraryExtended'
import trackAnalyticsEvent from 'store/actions/trackAnalyticsEvent'
import UploadPhoto from './UploadPhoto'

jest.mock('store/actions/trackAnalyticsEvent', () => jest.fn(() => ({ type: 'TRACK_ANALYTICS_EVENT' })))

afterEach(() => {
  trackAnalyticsEvent.mockClear()
})

function providersWithUser (user) {
  const ormSession = orm.mutableSession(orm.getEmptyState())
  if (user) ormSession.Me.create(user)
  return AllTheProviders({ orm: ormSession.state })
}

describe('UploadPhoto', () => {
  it('renders correctly', () => {
    render(
      <UploadPhoto />,
      { wrapper: providersWithUser({ id: '1', name: 'Test User', avatarUrl: 'avatar.png' }) }
    )

    expect(screen.getByText('STEP 1/3')).toBeInTheDocument()
    expect(screen.getByText('Upload a profile image')).toBeInTheDocument()
    expect(screen.getByText('Next: Where are you from?')).toBeInTheDocument()
    expect(screen.getByTestId('upload-attachment-button')).toBeInTheDocument()
    expect(screen.getByTestId('upload-photo-button')).toBeInTheDocument()
  })

  it('displays loading when currentUser is not provided', () => {
    render(<UploadPhoto />, { wrapper: providersWithUser(null) })
    expect(screen.getByTestId('loading-indicator')).toBeInTheDocument()
  })

  it('tracks the step being viewed', () => {
    render(
      <UploadPhoto />,
      { wrapper: providersWithUser({ id: '1', name: 'Test User' }) }
    )

    expect(trackAnalyticsEvent).toHaveBeenCalledWith('Welcome Wizard Step Viewed', { step: 'upload-photo' })
  })

  it('tracks the step as skipped when continuing without uploading a photo', async () => {
    const user = userEvent.setup()
    render(
      <UploadPhoto />,
      { wrapper: providersWithUser({ id: '1', name: 'Test User' }) }
    )

    await user.click(screen.getByText('Next: Where are you from?'))

    expect(trackAnalyticsEvent).toHaveBeenCalledWith('Welcome Wizard Step Skipped', { step: 'upload-photo' })
  })
})
