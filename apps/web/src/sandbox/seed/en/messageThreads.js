import { PLACEHOLDER_COPY } from '../constants'
import { htmlCopy, sid } from '../helpers'
import { MAIN_GROUP_ID } from './groups'
import { ME_ID } from './people'

/**
 * Three DM threads: one group thread + two one-on-one.
 */
export function buildMessageThreads (peopleById) {
  const me = peopleById[ME_ID]
  const p2 = peopleById['sandbox-person-002']
  const p3 = peopleById['sandbox-person-003']
  const p4 = peopleById['sandbox-person-004']
  const p5 = peopleById['sandbox-person-005']

  return [
    groupThread({
      id: sid('thread', 'group'),
      participants: [me, p2, p3, p4, p5],
      messages: [
        dmMessage(sid('msg', 'g', '001'), me, -9000, PLACEHOLDER_COPY.slice(0, 120)),
        dmMessage(sid('msg', 'g', '002'), p2, -8800, PLACEHOLDER_COPY.slice(0, 100)),
        dmMessage(sid('msg', 'g', '003'), p3, -8600, PLACEHOLDER_COPY.slice(0, 90)),
        dmMessage(sid('msg', 'g', '004'), me, -8400, PLACEHOLDER_COPY.slice(0, 110))
      ],
      contextGroupId: MAIN_GROUP_ID
    }),
    directThread({
      id: sid('thread', 'dm', '002'),
      participants: [me, p2],
      messages: [
        dmMessage(sid('msg', 'dm2', '001'), p2, -12000, PLACEHOLDER_COPY.slice(0, 80)),
        dmMessage(sid('msg', 'dm2', '002'), me, -11800, PLACEHOLDER_COPY.slice(0, 95)),
        dmMessage(sid('msg', 'dm2', '003'), p2, -11600, PLACEHOLDER_COPY.slice(0, 70))
      ]
    }),
    directThread({
      id: sid('thread', 'dm', '003'),
      participants: [me, p3],
      messages: [
        dmMessage(sid('msg', 'dm3', '001'), me, -20000, PLACEHOLDER_COPY.slice(0, 100)),
        dmMessage(sid('msg', 'dm3', '002'), p3, -19800, PLACEHOLDER_COPY.slice(0, 85))
      ],
      unreadCount: 1
    })
  ]
}

function groupThread ({ id, participants, messages, contextGroupId }) {
  return {
    id,
    type: 'group',
    contextGroupId,
    participants,
    participantsTotal: participants.length,
    unreadCount: 0,
    isMuted: false,
    createdAt_offset: -86400 * 10,
    updatedAt_offset: messages[messages.length - 1]?.createdAt_offset || -8400,
    lastReadAt_offset: -8500,
    messages: { items: messages, total: messages.length, hasMore: false }
  }
}

function directThread ({ id, participants, messages, unreadCount = 0 }) {
  return {
    id,
    type: 'direct',
    contextGroupId: null,
    participants,
    participantsTotal: participants.length,
    unreadCount,
    isMuted: false,
    createdAt_offset: -86400 * 5,
    updatedAt_offset: messages[messages.length - 1]?.createdAt_offset || -11600,
    lastReadAt_offset: unreadCount ? null : -11700,
    messages: { items: messages, total: messages.length, hasMore: false }
  }
}

function dmMessage (id, creator, createdAt_offset, text) {
  return {
    id,
    text: htmlCopy(text),
    createdAt_offset,
    editedAt: null,
    creator: { id: creator.id, name: creator.name, avatarUrl: creator.avatarUrl }
  }
}
