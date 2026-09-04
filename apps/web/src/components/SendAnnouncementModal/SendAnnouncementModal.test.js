import React from 'react'
import { render, screen } from 'util/testing/reactTestingLibraryExtended'
import SendAnnouncementModal from './SendAnnouncementModal'

describe('SendAnnouncementModal', () => {
  const defaultProps = {
    closeModal: jest.fn(),
    save: jest.fn(),
    groupCount: 1,
    myAdminGroups: [{ id: 1 }],
    groups: [{ id: 1 }]
  }

  it('renders correctly with one group', () => {
    render(<SendAnnouncementModal {...defaultProps} />)

    expect(screen.getByText('MAKE AN ANNOUNCEMENT')).toBeInTheDocument()
    expect(screen.getByText(/This marks the post as important and notifies everyone who hasn't turned off post notifications/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Go Back' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Send It' })).toBeInTheDocument()
  })

  it('renders correctly with multiple groups', () => {
    const props = {
      ...defaultProps,
      groupCount: 2,
      myAdminGroups: [{ id: 1 }, { id: 2 }],
      groups: [{ id: 1 }, { id: 2 }]
    }
    render(<SendAnnouncementModal {...props} />)

    expect(screen.getByText(/This marks the post as important and notifies everyone in the 2 selected groups who hasn't turned off post notifications/)).toBeInTheDocument()
  })

  it('renders correctly with multiple groups, where the current user is not always a moderator', () => {
    const props = {
      ...defaultProps,
      groupCount: 2,
      myAdminGroups: [{ id: 1 }],
      groups: [{ id: 1 }, { id: 2 }]
    }
    render(<SendAnnouncementModal {...props} />)

    expect(screen.getByText(/This marks the post as important and notifies everyone in the 2 selected groups who hasn't turned off post notifications/)).toBeInTheDocument()
    expect(screen.getByText(/This will only be sent as an Announcement to the groups where you are a Moderator/)).toBeInTheDocument()
  })

  it('calls closeModal when Go Back button is clicked', () => {
    render(<SendAnnouncementModal {...defaultProps} />)

    screen.getByRole('button', { name: 'Go Back' }).click()
    expect(defaultProps.closeModal).toHaveBeenCalled()
  })

  it('calls save when Send It button is clicked', () => {
    render(<SendAnnouncementModal {...defaultProps} />)

    screen.getByRole('button', { name: 'Send It' }).click()
    expect(defaultProps.save).toHaveBeenCalled()
  })
})
