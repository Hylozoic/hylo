import React from 'react'
import orm from 'store/models'
import { AllTheProviders, render, screen } from 'util/testing/reactTestingLibraryExtended'
import UploadPhoto from './UploadPhoto'

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
})
