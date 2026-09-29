import React from 'react'
import { toast } from 'sonner'
import { TextHelpers } from '@hylo/shared'
import RoundImage from 'components/RoundImage'
import orm from 'store/models'
import {
  bodyForNotification,
  imageForNotification,
  isDirectAction,
  titleForNotification,
  urlForNotification
} from '@hylo/presenters/NotificationPresenter'

// Toasts for direct notifications and direct messages that arrive while the web app is
// open (D71). Called from the socket handlers, never from a reducer. Other
// notifications only bump the counter.

const HTML_ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }
const escapeHTML = value =>
  typeof value === 'string' ? value.replace(/[&<>"']/g, char => HTML_ESCAPES[char]) : value

// Names and post text are user input, and the presenter strings are rendered as HTML
const escapingT = t => (key, values) => t(key, values && Object.fromEntries(
  Object.entries(values).map(([name, value]) => [name, escapeHTML(value)])
))

const pathOf = url => String(url || '').split(/[?#]/)[0].replace(/\/+$/, '')

// True when the viewer is already looking at what the notification points to.
export function isOnTarget (pathname, url, postId) {
  const current = pathOf(pathname)
  if (current && current === pathOf(url)) return true
  return !!postId && new RegExp(`/post/${postId}(/|$)`).test(current)
}

// The desktop app shows its own system notification for these.
const desktopShowsNotifications = () => typeof window !== 'undefined' && !!window.electron

export function shouldToastNotification (notification, { pathname } = {}) {
  if (desktopShowsNotifications()) return false
  if (!isDirectAction(notification)) return false
  let url
  try {
    url = urlForNotification(notification)
  } catch (e) {
    return false
  }
  if (!url) return false
  return !isOnTarget(pathname, url, notification.activity?.post?.id)
}

export function showNotificationToast (notification, { t, pathname, open }) {
  if (!shouldToastNotification(notification, { pathname })) return false
  const url = urlForNotification(notification)
  const tEscaped = escapingT(t)
  const title = titleForNotification(notification, tEscaped)
  if (!title) return false
  const body = bodyForNotification(notification, tEscaped)
  toast(<span dangerouslySetInnerHTML={{ __html: title }} />, {
    id: `notification-${notification.id}`,
    description: body ? <span dangerouslySetInnerHTML={{ __html: body }} /> : undefined,
    icon: <RoundImage url={imageForNotification(notification)} medium />,
    action: { label: t('View'), onClick: () => open(url) }
  })
  return true
}

export function shouldToastMessage (message, { viewingThread, isMuted } = {}) {
  if (desktopShowsNotifications()) return false
  if (viewingThread || isMuted) return false
  return !!message?.messageThread
}

// sender: { name, avatarUrl } when the app knows them
export function showMessageToast (message, { t, sender, viewingThread, isMuted, open }) {
  if (!shouldToastMessage(message, { viewingThread, isMuted })) return false
  const url = `/messages/${message.messageThread}`
  const preview = TextHelpers.presentHTMLToText(message.text || '', { truncate: 100 })
  toast(sender?.name ? t('{{name}} sent you a message', { name: sender.name }) : t('New Message'), {
    id: `message-${message.id}`,
    description: preview || undefined,
    icon: sender?.avatarUrl ? <RoundImage url={sender.avatarUrl} medium /> : undefined,
    action: { label: t('View'), onClick: () => open(url) }
  })
  return true
}

// What the socket handlers call. getState reads the store for the sender's name and a
// thread's mute setting; open navigates to a URL.
export function createToaster ({ getState, t, open }) {
  const session = () => orm.session(getState().orm)

  const personFor = personId => {
    const { Person } = session()
    if (!personId || !Person.idExists(personId)) return null
    const person = Person.withId(personId)
    return { name: person.name, avatarUrl: person.avatarUrl }
  }

  const threadIsMuted = threadId => {
    const { MessageThread } = session()
    return !!threadId && MessageThread.idExists(threadId) && !!MessageThread.withId(threadId).isMuted
  }

  const message = (msg, { viewingThread, isMuted, sender } = {}) =>
    showMessageToast(msg, {
      t,
      open,
      viewingThread,
      sender: sender || personFor(msg?.creator),
      isMuted: isMuted || threadIsMuted(msg?.messageThread)
    })

  return {
    notification: (notification, { pathname } = {}) =>
      showNotificationToast(notification, { t, pathname, open }),

    message,

    // The first message of a new thread
    thread: (thread, { viewingThread, isMuted } = {}) => {
      const last = thread?.messages?.[thread.messages.length - 1]
      if (!last) return false
      const creator = (thread.participants || []).find(p => String(p.id) === String(last.creator))
      return message({ ...last, messageThread: thread.id }, {
        viewingThread,
        isMuted,
        sender: creator && { name: creator.name, avatarUrl: creator.avatarUrl }
      })
    }
  }
}
