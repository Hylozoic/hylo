import { PLACEHOLDER_COPY } from '../constants'
import { htmlCopy, sid } from '../helpers'
import { MAIN_GROUP_ID } from './groups'
import { ME_ID } from './people'

/**
 * Three DM threads: one group thread + two one-on-one.
 */
export function buildMessageThreads (peopleById) {
  const me = peopleById[ME_ID]
  const p2 = peopleById[sid('person', '002')]
  const p3 = peopleById[sid('person', '003')]
  const p4 = peopleById[sid('person', '004')]
  const p5 = peopleById[sid('person', '005')]

  return [
    groupThread({
      id: sid('thread', 'group'),
      participants: [me, p2, p3, p4, p5],
      messages: [
        dmMessage(sid('msg', 'g', '001'), me, -9000, "Hey everyone 👋 Just wanted to check in — how did the permaculture session go for those who attended?"),
        dmMessage(sid('msg', 'g', '002'), p2, -8800, "It was incredible! Kevin shared so much about how the Bay Area permaculture community evolved over the decades."),
        dmMessage(sid('msg', 'g', '003'), p3, -8600, "I loved the part about bioregional identity. Really connected to what we're building with Hylo."),
        dmMessage(sid('msg', 'g', '004'), me, -8400, "Agreed. Notes and video are up in the stream now — check them out!")
      ],
      contextGroupId: MAIN_GROUP_ID
    }),
    directThread({
      id: sid('thread', 'dm', '002'),
      participants: [me, p2],
      messages: [
        dmMessage(sid('msg', 'dm2', '001'), p2, -12000, "Hi Elena! Quick question — do you know anyone working on rights of nature campaigns in the watershed area?"),
        dmMessage(sid('msg', 'dm2', '002'), me, -11800, "Yes! I just posted about this in the stream. Thomas Linzey from Bioneers also reached out."),
        dmMessage(sid('msg', 'dm2', '003'), p2, -11600, "Amazing, I'll reach out to Elena. Thanks!")
      ]
    }),
    directThread({
      id: sid('thread', 'dm', '003'),
      participants: [me, p3],
      messages: [
        dmMessage(sid('msg', 'dm3', '001'), me, -20000, "Hey! Loved your comment on the $5 million question. Would you be up for a call this week to explore some of those ideas further?"),
        dmMessage(sid('msg', 'dm3', '002'), p3, -19800, "Absolutely — how about Thursday at 10am PT? I have a lot of thoughts on this!")
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
