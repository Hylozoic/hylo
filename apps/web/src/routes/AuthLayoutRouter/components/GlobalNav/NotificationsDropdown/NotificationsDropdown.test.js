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
} from '@hylo/presenters/NotificationPresenter'

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

const spaceJoinRequestNotification = {
  id: 31,
  activity: {
    actor: u2,
    action: ACTION_JOIN_REQUEST,
    meta: {},
    group: { name: 'The Space', slug: 'the-space' },
    otherGroup: { name: 'Foomunity', slug: 'foomunity' },
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
  const expectItemText = (container, ...snippets) => {
    const text = container.textContent
    snippets.forEach(snippet => expect(text).toMatch(snippet))
  }

  it('renders correctly with a comment notification', async () => {
    const { container } = render(<NotificationItem notification={commentNotification} />)
    await waitFor(() => {
      expectItemText(container, /Marie Curie/i, /wrote:/i, /Our Oceans|petitioning/i)
    })
  })

  it('renders correctly with a tag notification', async () => {
    const { container } = render(<NotificationItem notification={tagNotification} />)
    await waitFor(() => {
      expectItemText(container, /Arthur Fonzarelli/i, /I have so many things I need!/i)
    })
  })

  it('renders correctly with a join request notification', async () => {
    const { container } = render(<NotificationItem notification={joinRequestNotification} />)
    await waitFor(() => {
      expectItemText(container, /asked to join/i, /Foomunity/i)
    })
  })

  it('renders a space join request with the space and parent group names', async () => {
    const { container } = render(<NotificationItem notification={spaceJoinRequestNotification} />)
    await waitFor(() => {
      expectItemText(container, /asked to join/i, /The Space/i, /Foomunity/i)
    })
  })

  it('renders correctly with an approved join request notification', async () => {
    const { container } = render(<NotificationItem notification={approvedJoinRequestNotification} />)
    await waitFor(() => {
      expectItemText(container, /approved your request to join/i, /Foomunity/i)
    })
  })

  it('renders correctly with a mention notification', async () => {
    const { container } = render(<NotificationItem notification={mentionNotification} />)
    await waitFor(() => {
      expectItemText(container, /Marie Curie/i, /Heads up/i)
    })
  })

  it('renders correctly with a donation to notification', async () => {
    const { container } = render(<NotificationItem notification={donationToNotification} />)
    await waitFor(() => {
      expectItemText(container, /contributed/i, /Our Oceans/i)
    })
  })

  it('renders correctly with a donation from notification', async () => {
    const { container } = render(<NotificationItem notification={donationFromNotification} />)
    await waitFor(() => {
      expectItemText(container, /contributed/i, /Our Oceans/i)
    })
  })

  it('renders correctly with a comment mention notification', async () => {
    const { container } = render(<NotificationItem notification={commentMentionNotification} />)
    await waitFor(() => {
      expectItemText(container, /Marie Curie/i, /mentioned you in a comment/i, /wrote:/i)
    })
  })
})
