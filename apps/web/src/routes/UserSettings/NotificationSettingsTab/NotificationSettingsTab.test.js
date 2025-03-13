import React from 'react'
import { render, screen, fireEvent, waitForElementToBeRemoved, AllTheProviders } from 'util/testing/reactTestingLibraryExtended'
import NotificationSettingsTab from './NotificationSettingsTab'
import MembershipSettingsRow from './MembershipSettingRow'
import SettingsRow from './SettingToggles'
import SettingsIcon from './SettingsIcon'
import orm from 'store/models'

function testProviders () {
  const ormSession = orm.mutableSession(orm.getEmptyState())
  ormSession.Me.create({ id: '1' })
  const reduxState = { orm: ormSession.state }

  return AllTheProviders(reduxState)
}

describe('NotificationSettingsTab', () => {
  const currentUser = {
    hasDevice: true,
    settings: {
      dmNotifications: 'both',
      commentNotifications: 'email'
    }
  }

  const defaultProps = {
    messageSettings: {
      sendEmail: true
    },
    allGroupsSettings: {
      sendEmail: true,
      sendPushNotifications: true,
      postNotifications: 'all',
      digestFrequency: 'daily'
    },
    updateUserSettings: jest.fn(),
    currentUser,
    memberships: [
      { 
        id: 1, 
        settings: { 
          sendEmail: true,
          sendPushNotifications: true,
          postNotifications: 'all',
          digestFrequency: 'daily'
        }, 
        group: { 
          id: '1',
          name: 'Group 1', 
          avatarUrl: 'group1.png',
          chatRooms: { toModelArray: () => [] }
        } 
      }, 
      { 
        id: 2, 
        settings: { 
          sendEmail: true,
          sendPushNotifications: false,
          postNotifications: 'important',
          digestFrequency: 'weekly'
        }, 
        group: { 
          id: '2',
          name: 'Group 2', 
          avatarUrl: 'group2.png',
          chatRooms: { 
            toModelArray: () => [{
              id: '1',
              groupTopic: {
                topic: { name: 'general' }
              },
              topicFollow: {
                id: '1',
                settings: { notifications: 'important' }
              }
            }]
          }
        } 
      }
    ]
  }

  it('renders correctly', () => {
    render(
      <NotificationSettingsTab {...defaultProps} />,
      { wrapper: testProviders() }
    )
    expect(screen.getByText('GLOBAL NOTIFICATIONS')).toBeInTheDocument()
    expect(screen.getByText('Messages')).toBeInTheDocument()
    expect(screen.getByText('Comments on followed posts')).toBeInTheDocument()
    expect(screen.getAllByText('Push Notifications')).toHaveLength(3)
    expect(screen.getAllByText('Email')).toHaveLength(3)
  })

  it('offers mobile app option if user has device', () => {
    render(
      <NotificationSettingsTab
        {...defaultProps}
        currentUser={{
          ...currentUser,
          hasDevice: false
        }}
      />,
      { wrapper: testProviders() }
    )
    expect(screen.getByText('iOS')).toBeInTheDocument()
    expect(screen.getByText('Android')).toBeInTheDocument()
  })

  it('renders loading state when currentUser is null', () => {
    render(
      <NotificationSettingsTab
        {...defaultProps}
        currentUser={null}
      />,
      { wrapper: testProviders() }
    )
    expect(screen.getByTestId('loading-container')).toBeInTheDocument()
  })

  it('renders correct number of group membership rows', () => {
    render(
      <NotificationSettingsTab {...defaultProps} />,
      { wrapper: testProviders() }
    )
    expect(screen.getByText('Group 1')).toBeInTheDocument()
    expect(screen.getByText('Group 2')).toBeInTheDocument()
    expect(screen.getByText('All Groups')).toBeInTheDocument()
  })

  it('shows initial notification settings for groups', async () => {
    const { getByRole, getByLabelText, getByText } = render(
      <NotificationSettingsTab {...defaultProps} />,
      { wrapper: testProviders() }
    )

    // Check All Groups settings
    const allGroupsSection = getByText('All Groups').closest('div')
    expect(allGroupsSection).toBeInTheDocument()
    expect(getByLabelText('All groups email digest frequency')).toHaveTextContent('~ Mixed ~')
    expect(getByLabelText('All groups post notifications frequency')).toHaveTextContent('~ Mixed ~')

    // Click on Group 2 to expand it
    const group2Button = getByRole('button', { name: 'Toggle Group 2 settings' })
    fireEvent.click(group2Button)

    // Check Group 2 settings
    const group2Section = getByLabelText('Group 2 notification settings')
    expect(group2Section).toBeInTheDocument()
    expect(getByLabelText('Group 2 email digest frequency')).toHaveTextContent('Weekly')
    expect(getByLabelText('Group 2 post notifications frequency')).toHaveTextContent('Important Posts')

    // Check chat room notifications
    expect(getByLabelText('Group 2 general chat notifications frequency')).toHaveTextContent('Important Posts')
  })

  it('displays correct global notification settings', () => {
    render(
      <NotificationSettingsTab {...defaultProps} />,
      { wrapper: testProviders() }
    )
    
    // First find the sections by their text
    const messagesSection = screen.getByText('Messages')
    const commentsSection = screen.getByText('Comments on followed posts')
    expect(messagesSection).toBeInTheDocument()
    expect(commentsSection).toBeInTheDocument()

    // Find the toggle sections
    const messageToggles = messagesSection.closest('div')
    const commentToggles = commentsSection.closest('div')
    expect(messageToggles).toBeInTheDocument()
    expect(commentToggles).toBeInTheDocument()

    // Verify the message toggles exist
    expect(screen.getByRole('switch', { name: 'messages push notifications' })).toBeInTheDocument()
    expect(screen.getByRole('switch', { name: 'messages email notifications' })).toBeInTheDocument()

    // Verify the comment toggles exist
    expect(screen.getByRole('switch', { name: 'comments push notifications' })).toBeInTheDocument()
    expect(screen.getByRole('switch', { name: 'comments email notifications' })).toBeInTheDocument()
  })

  it('displays correct app store links', () => {
    render(
      <NotificationSettingsTab {...defaultProps} />,
      { wrapper: testProviders() }
    )
    
    const iosLink = screen.getByText('iOS').closest('a')
    const androidLink = screen.getByText('Android').closest('a')
    
    expect(iosLink).toHaveAttribute('href', 'https://itunes.apple.com/app/appName/id1002185140')
    expect(androidLink).toHaveAttribute('href', 'https://play.google.com/store/apps/details?id=com.hylo.hyloandroid')
    expect(iosLink).toHaveAttribute('target', '_blank')
    expect(androidLink).toHaveAttribute('target', '_blank')
  })

  it('expands group settings when clicked', () => {
    const { getByRole, queryByLabelText } = render(
      <NotificationSettingsTab {...defaultProps} />,
      { wrapper: testProviders() }
    )
    
    // Initially, group settings should not be visible
    expect(queryByLabelText('Group 1 email digest frequency')).not.toBeInTheDocument()
    expect(queryByLabelText('Group 1 post notifications frequency')).not.toBeInTheDocument()
    
    // Click on Group 1
    const group1Button = getByRole('button', { name: 'Toggle Group 1 settings' })
    fireEvent.click(group1Button)
    
    // Now group settings should be visible
    expect(getByRole('combobox', { name: 'Group 1 email digest frequency' })).toBeInTheDocument()
    expect(getByRole('combobox', { name: 'Group 1 post notifications frequency' })).toBeInTheDocument()
  })
})
