import React from 'react'
import { render, screen } from 'util/testing/reactTestingLibraryExtended'
import ImportExportSettingsTab from './ImportExportSettingsTab'

describe('ImportExportSettingsTab', () => {
  const group = {
    id: '1',
    name: 'Hylo'
  }

  it('renders correctly', () => {
    render(<ImportExportSettingsTab group={group} />)

    // Check for the title
    expect(screen.getByText('Import Posts by CSV')).toBeInTheDocument()

    // Check for the warning message
    expect(screen.getByText(/WARNING: This is a beta feature/)).toBeInTheDocument()

    // Check for the group name in the help text
    expect(screen.getByText(/You can select a CSV file to import posts into Hylo/)).toBeInTheDocument()

    // Check for the upload button
    expect(screen.getByText('Upload CSV')).toBeInTheDocument()

    // Check for some of the CSV column headers
    expect(screen.getByText('title: text')).toBeInTheDocument()
    expect(screen.getByText('description: text')).toBeInTheDocument()
    expect(screen.getByText('location: text')).toBeInTheDocument()
  })
})
