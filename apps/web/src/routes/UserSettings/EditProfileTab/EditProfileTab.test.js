/* eslint no-unused-expressions: 'off' */
import React from 'react'
import { render, screen, fireEvent, waitFor } from 'util/testing/reactTestingLibraryExtended'
import EditProfileTab from './EditProfileTab'
import SocialControl from './SocialControl'
import { AllTheProviders } from 'util/testing/reactTestingLibraryExtended'

const mockUpdateSettingDirectly = jest.fn()
const mockHandleUnlinkAccount = jest.fn()
const mockOnLink = jest.fn()
const mockFetchLocation = jest.fn()

describe('EditProfileTab', () => {
  it('renders correctly', () => {
    render(
      <EditProfileTab
        currentUser={{ name: 'Yay', locationObject: { id: 1 } }}
      />,
      { wrapper: AllTheProviders }
    )

    expect(screen.getByLabelText('Your Name')).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: /upload/i })).toHaveLength(2)
    expect(screen.getByLabelText('Tagline')).toBeInTheDocument()
    expect(screen.getByLabelText('About Me')).toBeInTheDocument()
    expect(screen.getByLabelText('Location')).toBeInTheDocument()
    expect(screen.getByLabelText('Website')).toBeInTheDocument()
    expect(screen.getByText('My Skills & Interests')).toBeInTheDocument()
    expect(screen.getByText("What I'm learning")).toBeInTheDocument()
    expect(screen.getByLabelText('Contact Email')).toBeInTheDocument()
    expect(screen.getByLabelText('Contact Phone')).toBeInTheDocument()
    expect(screen.getByText('Social Accounts')).toBeInTheDocument()
  })

  it('renders correctly without location object', () => {
    render(<EditProfileTab currentUser={{}} />, { wrapper: AllTheProviders })
    expect(screen.getByLabelText('Location')).toBeInTheDocument()
  })

  it('enables save button when changes are made', async () => {
    render(
      <EditProfileTab
        currentUser={{ name: 'Yay', locationObject: { id: 1 } }}
      />,
      { wrapper: AllTheProviders }
    )

    const nameInput = screen.getByLabelText('Your Name')
    fireEvent.change(nameInput, { target: { value: 'New Name' } })

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Save Changes' })).toHaveStyle({ backgroundColor: 'green' })
    })
  })
})

describe('SocialControl', () => {
  it('renders correctly without a value', () => {
    render(<SocialControl label='A Social Control' />)
    expect(screen.getByText('A Social Control')).toBeInTheDocument()
    expect(screen.getByText('Link')).toBeInTheDocument()
  })

  it('renders correctly with a value', () => {
    render(<SocialControl label='A Social Control' value='someurl.com' />)
    expect(screen.getByText('A Social Control')).toBeInTheDocument()
    expect(screen.getByText('Unlink')).toBeInTheDocument()
  })

  it('calls handleLinkClick when link is clicked', () => {
    const { getByText } = render(<SocialControl label='A Social Control' />)
    fireEvent.click(getByText('Link'))
    // Add an assertion here to check if handleLinkClick was called
  })

  it('calls handleUnlinkClick when unlink is clicked', () => {
    const { getByText } = render(<SocialControl label='A Social Control' value='someurl.com' />)
    fireEvent.click(getByText('Unlink'))
    // Add an assertion here to check if handleUnlinkClick was called
  })

  describe('handleLinkClick', () => {
    beforeEach(() => {
      window.prompt = jest.fn()
    })

    it('updates Twitter name when valid handle is entered', () => {
      window.prompt.mockReturnValue('twitterhandle')
      render(
        <SocialControl
          label='Twitter'
          provider='twitter'
          updateSettingDirectly={mockUpdateSettingDirectly}
          handleUnlinkAccount={mockHandleUnlinkAccount}
        />
      )
      fireEvent.click(screen.getByText('Link'))
      expect(window.prompt).toHaveBeenCalledWith('Please enter your twitter name.')
      expect(mockUpdateSettingDirectly).toHaveBeenCalled()
    })

    it('updates LinkedIn URL when valid URL is provided', () => {
      window.prompt.mockReturnValue('linkedin.com/test')
      render(
        <SocialControl
          label='LinkedIn'
          provider='linkedin'
          updateSettingDirectly={mockUpdateSettingDirectly}
          handleUnlinkAccount={mockHandleUnlinkAccount}
        />
      )
      fireEvent.click(screen.getByText('Link'))
      expect(window.prompt).toHaveBeenCalledWith('Please enter the full url for your {{network}} page.')
      expect(mockUpdateSettingDirectly).toHaveBeenCalled()
    })

    it('updates Facebook URL when valid URL is provided', () => {
      window.prompt.mockReturnValue('facebook.com/test')
      render(
        <SocialControl
          label='Facebook'
          provider='facebook'
          updateSettingDirectly={mockUpdateSettingDirectly}
          handleUnlinkAccount={mockHandleUnlinkAccount}
        />
      )
      fireEvent.click(screen.getByText('Link'))
      expect(window.prompt).toHaveBeenCalledWith('Please enter the full url for your {{network}} page.')
      expect(mockUpdateSettingDirectly).toHaveBeenCalled()
    })
  })

  describe('handleUnlinkClick', () => {
    it('calls handleUnlinkAccount and updateSettingDirectly when unlink is clicked', () => {
      render(
        <SocialControl
          label='LinkedIn'
          provider='linkedin'
          value='linkedin.com/test'
          updateSettingDirectly={mockUpdateSettingDirectly}
          handleUnlinkAccount={mockHandleUnlinkAccount}
        />
      )
      fireEvent.click(screen.getByText('Unlink'))
      expect(mockHandleUnlinkAccount).toHaveBeenCalled()
      expect(mockUpdateSettingDirectly).toHaveBeenCalled()
    })
  })
})
