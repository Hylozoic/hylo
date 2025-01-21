import React from 'react'
import mockGraphqlServer from 'util/testing/mockGraphqlServer'
import { graphql, HttpResponse } from 'msw'
import { render, screen, fireEvent, waitFor } from 'util/testing/reactTestingLibraryExtended'
import NotificationsDropdown from './NotificationsDropdown'
import NotificationItem from './NotificationItem'
import {
  ACTION_NEW_COMMENT,
  ACTION_TAG,
  ACTION_JOIN_REQUEST,
  ACTION_APPROVED_JOIN_REQUEST,
  ACTION_MENTION,
  ACTION_COMMENT_MENTION,
  ACTION_DONATION_TO,
  ACTION_DONATION_FROM
  // ACTION_EVENT_INVITATION
} from 'store/models/Notification'

const u1 = { id: 1, name: 'Charles Darwin', avatarUrl: 'foo.png' }
const u2 = { id: 2, name: 'Marie Curie', avatarUrl: 'bar.png' }
const u3 = { id: 3, name: 'Arthur Fonzarelli', avatarUrl: 'baz.png' }

const commentNotification = {
  id: 1,
  activity: {
    actor: u2,
    action: ACTION_NEW_COMMENT,
    meta: {},
    post: { title: 'Our Oceans' },
    comment: {
      text: "I live right next to there and can come help out. I've never done petitioning but I'm sure it's an absolute blast"
    },
    unread: true
  },
  createdAt: new Date(Date.UTC(1995, 11, 17, 3, 23, 0))
}

const tagNotification = {
  id: 2,
  activity: {
    actor: u3,
    action: ACTION_TAG,
    post: { title: 'I have so many things I need!' },
    meta: { reasons: ['tag: request'] },
    group: { name: 'Foomunity' },
    unread: true
  },
  createdAt: new Date(Date.UTC(1995, 11, 17, 3, 23, 0))
}

const joinRequestNotification = {
  id: 3,
  activity: {
    actor: u2,
    action: ACTION_JOIN_REQUEST,
    meta: {},
    group: { name: 'Foomunity' },
    unread: true
  },
  createdAt: new Date(Date.UTC(1995, 11, 17, 3, 23, 0))
}

const approvedJoinRequestNotification = {
  id: 4,
  activity: {
    actor: u2,
    action: ACTION_APPROVED_JOIN_REQUEST,
    meta: {},
    group: { name: 'Foomunity' },
    unread: true
  },
  createdAt: new Date(Date.UTC(1995, 11, 17, 3, 23, 0))
}

const mentionNotification = {
  id: 5,
  activity: {
    actor: u2,
    action: ACTION_MENTION,
    meta: {},
    post: { title: 'Heads up' },
    unread: true
  },
  createdAt: new Date(Date.UTC(1995, 11, 17, 3, 23, 0))
}

const commentMentionNotification = {
  id: 1,
  activity: {
    actor: u2,
    action: ACTION_COMMENT_MENTION,
    meta: {},
    post: { title: 'Our Oceans' },
    comment: {
      text: "I live right next to there and can come help out. I've never done petitioning but I'm sure it's an absolute blast"
    },
    unread: true
  },
  createdAt: new Date(Date.UTC(1995, 11, 17, 3, 23, 0))
}

const donationToNotification = {
  id: 1,
  activity: {
    actor: u2,
    action: ACTION_DONATION_TO,
    meta: {},
    post: { title: 'Our Oceans' },
    unread: true,
    contributionAmount: 12300
  },
  createdAt: new Date(Date.UTC(1995, 11, 17, 3, 23, 0))
}

const donationFromNotification = {
  id: 1,
  activity: {
    actor: u2,
    action: ACTION_DONATION_FROM,
    meta: {},
    post: { title: 'Our Oceans' },
    unread: true,
    contributionAmount: 12300
  },
  createdAt: new Date(Date.UTC(1995, 11, 17, 3, 23, 0))
}

const notifications = [
  commentNotification,
  tagNotification,
  { ...commentNotification, unread: false },
  { ...tagNotification, unread: false },
  joinRequestNotification,
  approvedJoinRequestNotification,
  mentionNotification,
  commentMentionNotification
]

// const eventInvitationNotification = {
//   id: 10,
//   activity: {
//     actor: u2,
//     action: ACTION_EVENT_INVITATION,
//     meta: {},
//     post: { title: 'Event' },
//     unread: true
//   },
//   createdAt: new Date(Date.UTC(1995, 11, 17, 3, 23, 0))
// }

describe('NotificationsDropdown', () => {
  beforeEach(() => {
    mockGraphqlServer.use(
      graphql.query('NotificationsQuery', () => {
        return HttpResponse.json({
          data: {
            notifications: null
          }
        })
      })
    )
  })

  it('renders correctly with an empty list', async () => {
    render(
      <NotificationsDropdown
        renderToggleChildren={() => <span>click me</span>}
        notifications={[]}
        currentUser={u1}
        fetchNotifications={jest.fn()}
      />
    )

    await waitFor(() => {
      expect(screen.getByText('click me')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByText('click me'))

    await waitFor(() => {
      expect(screen.getByText('No notifications')).toBeInTheDocument()
    })
  })

  it('renders correctly with a list of notifications', async () => {
    render(
      <NotificationsDropdown
        renderToggleChildren={() => <span>click me</span>}
        notifications={notifications}
        currentUser={u1}
        fetchNotifications={jest.fn()}
      />
    )

    await waitFor(() => {
      expect(screen.getByText('click me')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByText('click me'))

    await waitFor(() => {
      expect(screen.getByText('Recent')).toBeInTheDocument()
      expect(screen.getByText('Unread')).toBeInTheDocument()
      expect(screen.getByText('Mark all as read')).toBeInTheDocument()
    })
  })
})

describe('Notification', () => {
  it('renders correctly with a comment notification', async () => {
    render(<NotificationItem notification={commentNotification} />)
    await waitFor(() => {
      expect(screen.getByText(/New comment on/i)).toBeInTheDocument()
      expect(screen.getByText(/Our Oceans/i)).toBeInTheDocument()
    })
  })

  it('renders correctly with a tag notification', async () => {
    render(<NotificationItem notification={tagNotification} />)
    await waitFor(() => {
      expect(screen.getByText(/New post in/i)).toBeInTheDocument()
      expect(screen.getByText(/I have so many things I need!/i)).toBeInTheDocument()
    })
  })

  it('renders correctly with a join request notification', async () => {
    render(<NotificationItem notification={joinRequestNotification} />)
    await waitFor(() => {
      expect(screen.getByText(/asked to join/i)).toBeInTheDocument()
      expect(screen.getByText(/Foomunity/i)).toBeInTheDocument()
    })
  })

  it('renders correctly with an approved join request notification', async () => {
    render(<Notification notification={approvedJoinRequestNotification} />)
    await waitFor(() => {
      expect(screen.getByText(/approved your request to join/i)).toBeInTheDocument()
      expect(screen.getByText(/Foomunity/i)).toBeInTheDocument()
    })
  })

  it('renders correctly with a mention notification', async () => {
    render(<NotificationItem notification={mentionNotification} />)
    await waitFor(() => {
      expect(screen.getByText(/mentioned you/i)).toBeInTheDocument()
      expect(screen.getByText(/Heads up/i)).toBeInTheDocument()
    })
  })

  it('renders correctly with a donation to notification', async () => {
    render(<NotificationItem notification={donationToNotification} />)
    await waitFor(() => {
      expect(screen.getByText(/contributed to a project/i)).toBeInTheDocument()
      expect(screen.getByText(/Our Oceans/i)).toBeInTheDocument()
    })
  })

  it('renders correctly with a donation from notification', async () => {
    render(<NotificationItem notification={donationFromNotification} />)
    await waitFor(() => {
      expect(screen.getByText(/contributed to your project/i)).toBeInTheDocument()
      expect(screen.getByText(/Our Oceans/i)).toBeInTheDocument()
    })
  })

  it('renders correctly with a comment mention notification', async () => {
    render(<NotificationItem notification={commentMentionNotification} />)
    await waitFor(() => {
      expect(screen.getByText(/mentioned you in a comment on/i)).toBeInTheDocument()
      expect(screen.getByText(/Our Oceans/i)).toBeInTheDocument()
    })
  })
})
