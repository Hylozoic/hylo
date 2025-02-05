/* eslint no-unused-expressions: 'off' */
import React from 'react'
import { graphql, HttpResponse } from 'msw'
import mockGraphqlServer from 'util/testing/mockGraphqlServer'
import { render, screen, fireEvent, waitFor } from 'util/testing/reactTestingLibraryExtended'
import EditProfileTab from './EditProfileTab'
import SocialControl from './SocialControl'

const mockUpdateSettingDirectly = jest.fn(() => jest.fn())
const mockHandleUnlinkAccount = jest.fn()
const mockOnLink = jest.fn()
const mockFetchLocation = jest.fn()
const mockSetConfirm = jest.fn()

describe('EditProfileTab', () => {
  beforeEach(() => {
    mockGraphqlServer.use(
      graphql.query('MemberSkills', ({ query, variables }) => {
        return HttpResponse.json({
          data: {
            person: {
              id: 1,
              skills: { items: [] }
            }
          }
        })
      }),
      graphql.query('MemberSkillsToLearn', ({ query, variables }) => {
        return HttpResponse.json({
          data: {
            person: {
              id: 1,
              skillsToLearn: { items: [] }
            }
          }
        })
      })
    )
  })

  it('renders correctly', async () => {
    render(
      <EditProfileTab
        currentUser={{ name: 'Yay', locationObject: { id: 1 } }}
      />
    )

    await waitFor(() => {
      expect(screen.getByLabelText('Your Name')).toBeInTheDocument()
      expect(screen.getAllByRole('button')).toHaveLength(1)
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
  })

  it('renders correctly without location object', async () => {
    render(<EditProfileTab currentUser={{}} />)
    await waitFor(() => {
      expect(screen.getByLabelText('Location')).toBeInTheDocument()
    })
  })

  it('enables save button when changes are made', async () => {
    render(
      <EditProfileTab
        currentUser={{ name: 'Yay', locationObject: { id: 1 } }}
        setConfirm={mockSetConfirm}
      />
    )

    await waitFor(() => {
      expect(screen.getByLabelText('Your Name')).toBeInTheDocument()
    })

    const nameInput = screen.getByLabelText('Your Name')
    fireEvent.change(nameInput, { target: { value: 'New Name' } })

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Save Changes' })).toHaveClass('green')
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
    const { getByText } = render(<SocialControl label='A Social Control' value='someurl.com' handleUnlinkAccount={mockHandleUnlinkAccount} updateSettingDirectly={mockUpdateSettingDirectly} />)
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
