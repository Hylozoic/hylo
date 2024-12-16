import React from 'react'
import { render, screen } from 'util/testing/reactTestingLibraryExtended'
import UploadPhoto from './UploadPhoto'

describe('UploadPhoto', () => {
  it('renders correctly', () => {
    render(<UploadPhoto currentUser={true} />)

    // Check for key elements
    expect(screen.getByText('STEP 1/3')).toBeInTheDocument()
    expect(screen.getByText('Upload a profile image')).toBeInTheDocument()
    expect(screen.getByText('Next: Where are you from?')).toBeInTheDocument()

    // Check for the upload button
    expect(screen.getByTestId('upload-attachment-button')).toBeInTheDocument()

    // Check for the icon
    expect(screen.getByTestId('icon-AddImage')).toBeInTheDocument()
  })

  it('displays loading when currentUser is not provided', () => {
    render(<UploadPhoto currentUser={null} />)
    expect(screen.getByTestId('loading-indicator')).toBeInTheDocument()
  })
})
