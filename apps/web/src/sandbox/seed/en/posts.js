import { PLACEHOLDER_COPY, PLACEHOLDER_NAME } from '../constants'
import { defaultLocationObject, htmlCopy, sid } from '../helpers'
import {
  CHAT_SPACE_ID,
  FUNDING_SPACE_ID,
  MAIN_GROUP_ID,
  SIMPLE_GROUP_ID
} from './groups'
import { FUNDING_ROUND_ID } from './fundingRounds'

/**
 * All sandbox posts. Keys: mainStream, chatSpace, fundingSubmissions, simpleGroupChat.
 * Edit title/details fields — placeholders use PLACEHOLDER_NAME / PLACEHOLDER_COPY.
 */
export function buildPosts (peopleById, meId) {
  const me = peopleById[meId]
  const groupRef = id => ({ id, name: PLACEHOLDER_NAME, slug: id === MAIN_GROUP_ID ? 'demo-community' : 'starter-circle' })

  return {
    mainStream: [
      discussionPost('001', me, MAIN_GROUP_ID, -86400 * 14, {
        announcement: true,
        commentCount: 1,
        reactionCount: 3
      }),
      discussionPost('002', peopleById['sandbox-person-002'], MAIN_GROUP_ID, -86400 * 10, {
        commentCount: 5,
        reactionCount: 2
      }),
      eventPost('003', peopleById['sandbox-person-003'], MAIN_GROUP_ID, -86400 * 8, {
        upcoming: true,
        commentCount: 1,
        reactionCount: 1
      }),
      eventPost('004', peopleById['sandbox-person-004'], MAIN_GROUP_ID, -86400 * 20, {
        upcoming: false,
        commentCount: 0
      }),
      proposalPost('005', me, MAIN_GROUP_ID, -86400 * 12, { voting: true }),
      requestPost('006', peopleById['sandbox-person-005'], MAIN_GROUP_ID, -86400 * 6, {
        commentCount: 1
      }),
      offerPost('007', peopleById['sandbox-person-006'], MAIN_GROUP_ID, -86400 * 5),
      discussionPost('008', peopleById['sandbox-person-007'], MAIN_GROUP_ID, -86400 * 4, {
        withLocation: true
      }),
      discussionPost('009', peopleById['sandbox-person-008'], MAIN_GROUP_ID, -86400 * 3),
      proposalPost('010', peopleById['sandbox-person-009'], MAIN_GROUP_ID, -86400 * 2, {
        discussionPhase: true
      }),
      requestPost('011', peopleById['sandbox-person-010'], MAIN_GROUP_ID, -86400),
      offerPost('012', peopleById['sandbox-person-011'], MAIN_GROUP_ID, -43200)
    ],
    chatSpace: [
      chatPost('chat', '001', me, CHAT_SPACE_ID, -7200),
      chatPost('chat', '002', peopleById['sandbox-person-012'], CHAT_SPACE_ID, -7000),
      chatPost('chat', '003', peopleById['sandbox-person-013'], CHAT_SPACE_ID, -6800),
      chatPost('chat', '004', peopleById['sandbox-person-014'], CHAT_SPACE_ID, -6600),
      chatPost('chat', '005', me, CHAT_SPACE_ID, -6400),
      chatPost('chat', '006', peopleById['sandbox-person-015'], CHAT_SPACE_ID, -6200),
      chatPost('chat', '007', peopleById['sandbox-person-016'], CHAT_SPACE_ID, -6000),
      chatPost('chat', '008', peopleById['sandbox-person-017'], CHAT_SPACE_ID, -5800)
    ],
    fundingSubmissions: [
      fundingSubmission('001', peopleById['sandbox-person-018'], FUNDING_SPACE_ID, -86400 * 5, 24),
      fundingSubmission('002', peopleById['sandbox-person-019'], FUNDING_SPACE_ID, -86400 * 4, 18),
      fundingSubmission('003', peopleById['sandbox-person-020'], FUNDING_SPACE_ID, -86400 * 3, 22)
    ],
    simpleGroupChat: [
      chatPost('simple', '001', me, SIMPLE_GROUP_ID, -3600),
      chatPost('simple', '002', peopleById['sandbox-person-starter-001'], SIMPLE_GROUP_ID, -3400),
      chatPost('simple', '003', peopleById['sandbox-person-starter-002'], SIMPLE_GROUP_ID, -3200),
      chatPost('simple', '004', peopleById['sandbox-person-starter-003'], SIMPLE_GROUP_ID, -3000),
      chatPost('simple', '005', me, SIMPLE_GROUP_ID, -2800)
    ],
    byId: null // filled below
  }
}

function basePost (id, creator, groupId, createdAt_offset, type, extras = {}) {
  return {
    id: sid('post', id),
    title: extras.title || PLACEHOLDER_NAME,
    details: extras.details || htmlCopy(),
    type,
    createdAt_offset,
    updatedAt_offset: createdAt_offset + 3600,
    creator,
    groups: [{ id: groupId, name: PLACEHOLDER_NAME }],
    groupsTotal: 1,
    commentsTotal: extras.commentCount || 0,
    commentersTotal: extras.commentCount || 0,
    postReactionsTotal: extras.reactionCount || 0,
    peopleReactedTotal: extras.reactionCount || 0,
    followersTotal: extras.commentCount || 0,
    topicsTotal: 0,
    isPublic: false,
    announcement: extras.announcement || false,
    ...extras.fields
  }
}

function discussionPost (num, creator, groupId, createdAt_offset, extras = {}) {
  const fields = {}
  if (extras.withLocation) {
    fields.location = PLACEHOLDER_COPY.slice(0, 60)
    fields.locationObject = defaultLocationObject(sid('location', 'post', num))
  }
  return basePost(num, creator, groupId, createdAt_offset, 'discussion', { ...extras, fields })
}

function eventPost (num, creator, groupId, createdAt_offset, { upcoming, ...rest } = {}) {
  const start = upcoming ? 86400 * 5 : -86400 * 3
  const end = upcoming ? 86400 * 5 + 7200 : -86400 * 3 + 7200
  return basePost(num, creator, groupId, createdAt_offset, 'event', {
    ...rest,
    fields: {
      startTime_offset: start,
      endTime_offset: end,
      timezone: 'America/Los_Angeles',
      location: PLACEHOLDER_COPY.slice(0, 60),
      meetingLink: null,
      myEventResponse: upcoming ? 'yes' : null
    }
  })
}

function proposalPost (num, creator, groupId, createdAt_offset, { voting, discussionPhase } = {}) {
  return basePost(num, creator, groupId, createdAt_offset, 'proposal', {
    fields: {
      proposalStatus: voting ? 'voting' : (discussionPhase ? 'discussion' : 'voting'),
      votingMethod: 'single',
      quorum: 20,
      isStrictProposal: false
    }
  })
}

function requestPost (num, creator, groupId, createdAt_offset, extras = {}) {
  return basePost(num, creator, groupId, createdAt_offset, 'request', {
    ...extras,
    fields: { endTime_offset: 86400 * 14 }
  })
}

function offerPost (num, creator, groupId, createdAt_offset, extras = {}) {
  return basePost(num, creator, groupId, createdAt_offset, 'offer', {
    ...extras,
    fields: { endTime_offset: 86400 * 30 }
  })
}

function chatPost (prefix, num, creator, groupId, createdAt_offset) {
  return basePost(`${prefix}-${num}`, creator, groupId, createdAt_offset, 'chat', {
    title: null,
    details: htmlCopy(PLACEHOLDER_COPY.slice(0, 140))
  })
}

function fundingSubmission (num, creator, groupId, createdAt_offset, tokensAllocated) {
  return basePost(`fr-${num}`, creator, groupId, createdAt_offset, 'project', {
    fields: {
      budget: PLACEHOLDER_COPY.slice(0, 40),
      fundingRound: { id: FUNDING_ROUND_ID, title: PLACEHOLDER_NAME },
      tokensAllocated,
      totalTokensAllocated: tokensAllocated + 8
    }
  })
}

/** Flat id → post map for resolvers */
export function indexPosts (collections) {
  const byId = {}
  for (const list of Object.values(collections)) {
    if (!Array.isArray(list)) continue
    for (const post of list) {
      byId[post.id] = post
    }
  }
  return byId
}
