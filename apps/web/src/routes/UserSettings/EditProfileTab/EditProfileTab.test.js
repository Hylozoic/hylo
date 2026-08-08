/* eslint no-unused-expressions: 'off' */
import React from 'react'
import { render, screen, fireEvent } from 'util/testing/reactTestingLibraryExtended'
import SocialControl from './SocialControl'

const mockUpdateSettingDirectly = jest.fn(() => jest.fn())
const mockHandleUnlinkAccount = jest.fn()

// EditProfileTab currently pulls heavy attachment/skills/editor deps that hang under Jest;
// cover the still-exported SocialControl interactions here as a focused unit test.
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
      expect(window.prompt).toHaveBeenCalledWith('Please enter the full url for your LinkedIn page.')
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
      expect(window.prompt).toHaveBeenCalledWith('Please enter the full url for your Facebook page.')
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
