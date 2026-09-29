import { toast } from 'sonner'
import orm from 'store/models'
import {
  createToaster,
  isOnTarget,
  shouldToastMessage,
  shouldToastNotification,
  showMessageToast,
  showNotificationToast
} from './directToasts'

jest.mock('sonner', () => ({
  ...jest.requireActual('sonner'),
  toast: jest.fn()
}))

const t = (key, values) => values?.name ? key.replace('{{name}}', values.name) : key

const notificationFor = (action, activity = {}) => ({
  id: '99',
  activity: {
    id: '12',
    action,
    actor: { id: '3', name: 'Sam', avatarUrl: 'https://example.com/sam.png' },
    post: { id: '5', title: 'Garden day', details: '', topics: [] },
    comment: { id: '8', text: 'Count me in' },
    group: { id: '1', name: 'Garden', slug: 'garden' },
    meta: { reasons: [action] },
    ...activity
  }
})

beforeEach(() => {
  toast.mockClear()
  delete window.electron
})

afterAll(() => {
  delete window.electron
})

describe('shouldToastNotification', () => {
  it('toasts a mention, a comment mention and an approved join request', () => {
    for (const action of ['mention', 'commentMention', 'approvedJoinRequest']) {
      expect(shouldToastNotification(notificationFor(action), { pathname: '/groups/garden/stream' })).toBe(true)
    }
  })

  it('toasts a comment that replies to you', () => {
    const reply = notificationFor('newComment', { replyToYou: true })
    expect(shouldToastNotification(reply, { pathname: '/my' })).toBe(true)
  })

  it('does not toast ambient notifications', () => {
    for (const action of ['newPost', 'chat', 'newComment', 'memberJoinedGroup', 'announcement']) {
      expect(shouldToastNotification(notificationFor(action), { pathname: '/my' })).toBe(false)
    }
  })

  it('does not toast when the viewer is already on the post', () => {
    expect(shouldToastNotification(notificationFor('mention'), { pathname: '/groups/garden/post/5' })).toBe(false)
    expect(shouldToastNotification(notificationFor('mention'), { pathname: '/groups/garden/stream/post/5' })).toBe(false)
  })

  it('does not toast when the desktop app shows its own notification', () => {
    window.electron = { showNotification: jest.fn() }
    expect(shouldToastNotification(notificationFor('mention'), { pathname: '/my' })).toBe(false)
  })
})

describe('isOnTarget', () => {
  it('ignores the query string and a trailing slash', () => {
    expect(isOnTarget('/groups/garden/', '/groups/garden?ctt=x')).toBe(true)
    expect(isOnTarget('/groups/other', '/groups/garden')).toBe(false)
  })
})

describe('showNotificationToast', () => {
  it('shows the title, the actor avatar and a View action that opens the notification', () => {
    const open = jest.fn()
    expect(showNotificationToast(notificationFor('mention'), { t, pathname: '/my', open })).toBe(true)

    expect(toast).toHaveBeenCalledTimes(1)
    const [, options] = toast.mock.calls[0]
    expect(options.id).toBe('notification-99')
    expect(options.icon.props.url).toBe('https://example.com/sam.png')
    expect(options.action.label).toBe('View')
    options.action.onClick()
    expect(open).toHaveBeenCalledWith(expect.stringContaining('/post/5'))
  })

  it('escapes names before rendering the title as HTML', () => {
    const notification = notificationFor('mention', { actor: { id: '3', name: '<img src=x>', avatarUrl: null } })
    showNotificationToast(notification, { t: (key, values) => `${values?.name}`, pathname: '/my', open: jest.fn() })
    const [title] = toast.mock.calls[0]
    expect(title.props.dangerouslySetInnerHTML.__html).toBe('&lt;img src=x&gt;')
  })

  it('shows nothing for an ambient notification', () => {
    expect(showNotificationToast(notificationFor('newPost'), { t, pathname: '/my', open: jest.fn() })).toBe(false)
    expect(toast).not.toHaveBeenCalled()
  })
})

describe('message toasts', () => {
  const message = { id: '40', messageThread: '7', creator: '3', text: '<p>Are you coming?</p>' }

  it('toasts a message in a thread the viewer is not reading', () => {
    const open = jest.fn()
    expect(showMessageToast(message, { t, sender: { name: 'Sam' }, open })).toBe(true)
    const [title, options] = toast.mock.calls[0]
    expect(title).toBe('Sam sent you a message')
    expect(options.description).toBe('Are you coming?')
    options.action.onClick()
    expect(open).toHaveBeenCalledWith('/messages/7')
  })

  it('does not toast the open thread or a muted one', () => {
    expect(shouldToastMessage(message, { viewingThread: true })).toBe(false)
    expect(shouldToastMessage(message, { isMuted: true })).toBe(false)
    expect(shouldToastMessage(message, {})).toBe(true)
  })

  it('still toasts in the desktop app, which shows no system notification for messages', () => {
    window.electron = { showNotification: jest.fn() }
    expect(shouldToastMessage(message, {})).toBe(true)
    expect(shouldToastMessage(message, { viewingThread: true })).toBe(false)
  })

  describe('createToaster', () => {
    const stateWith = populate => {
      const session = orm.mutableSession(orm.getEmptyState())
      populate(session)
      return { orm: session.state }
    }

    it("names the sender from the store and respects a thread's mute", () => {
      const state = stateWith(session => {
        session.Person.create({ id: '3', name: 'Sam', avatarUrl: 'https://example.com/sam.png' })
        session.MessageThread.create({ id: '9', isMuted: true })
      })
      const toaster = createToaster({ getState: () => state, t, open: jest.fn() })

      expect(toaster.message(message)).toBe(true)
      expect(toast.mock.calls[0][0]).toBe('Sam sent you a message')

      expect(toaster.message({ ...message, messageThread: '9' })).toBe(false)
    })

    it('toasts the first message of a new thread with the sender from its participants', () => {
      const state = stateWith(() => {})
      const toaster = createToaster({ getState: () => state, t, open: jest.fn() })
      const thread = {
        id: '11',
        participants: [{ id: '3', name: 'Sam', avatarUrl: null }, { id: '4', name: 'Me' }],
        messages: [{ id: '41', creator: '3', text: 'Hello' }]
      }
      expect(toaster.thread(thread, {})).toBe(true)
      expect(toast.mock.calls[0][0]).toBe('Sam sent you a message')
    })
  })
})
