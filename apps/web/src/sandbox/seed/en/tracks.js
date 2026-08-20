import { PLACEHOLDER_COPY, PLACEHOLDER_NAME } from '../constants'
import { sid } from '../helpers'
import { MAIN_COORDINATOR_ROLE_ID, TRACK_SPACE_ID } from './groups'

export const TRACK_ID = sid('track', 'onboarding')

export function buildTrack () {
  return {
    id: TRACK_ID,
    name: 'New Member Orientation',
    description: 'Welcome to Terran Collective! This short track will help you get oriented — learn how we communicate, find the projects that excite you, and meet some fellow Terrans.',
    groupId: TRACK_SPACE_ID,
    actionDescriptor: 'Orientation Step',
    actionDescriptorPlural: 'Orientation Steps',
    completionMessage: "Congratulations — you've completed the New Member Orientation! 🌱 You're now a full Terran. Welcome to the community. Jump into the chat, join a project, and don't hesitate to reach out to any of our Coordinators.",
    publishedAt_offset: -86400 * 30,
    accessControlled: false,
    canAccess: true,
    isEnrolled: true,
    didComplete: false,
    numPeopleEnrolled: 11,
    welcomeMessage: 'Take these four steps at your own pace. Completing them is how you become a full Terran.',
    completionRole: {
      id: MAIN_COORDINATOR_ROLE_ID,
      name: 'Coordinator',
      emoji: '🪄'
    },
    numActions: 4,
    numPeopleCompleted: 12
  }
}

/** Ordered track action posts (discussion-type completion steps) */
export function buildTrackActions (peopleById, meId) {
  const creator = peopleById[meId]
  return [
    trackActionPost(sid('track-action', '001'), 0, creator),
    trackActionPost(sid('track-action', '002'), 1, creator),
    trackActionPost(sid('track-action', '003'), 2, creator),
    trackActionPost(sid('track-action', '004'), 3, creator)
  ]
}

const TRACK_ACTION_CONTENT = [
  {
    title: 'Introduce yourself',
    details: '<p>Head to the General chat and write a short introduction — who you are, where you\'re from, and what brought you to Terran Collective. We love knowing what lights you up! 🌟</p>'
  },
  {
    title: 'Explore the stream',
    details: '<p>Browse the main Stream to get a feel for the kinds of conversations, projects, and events happening in the community. React to something that resonates with you — emoji reactions are a great first step into the conversation.</p>'
  },
  {
    title: 'Find a project or discussion to join',
    details: '<p>Is there a project, request, or discussion you\'d like to contribute to? Leave a comment, offer your skills, or simply let the person know you\'re interested. Collaboration starts with saying hello.</p>'
  },
  {
    title: 'Meet a Coordinator',
    details: '<p>Send a direct message to one of our Coordinators and introduce yourself. They\'re here to help you find your footing and connect you with the parts of Terran Collective that matter most to you.</p>'
  }
]

function trackActionPost (id, order, creator) {
  const content = TRACK_ACTION_CONTENT[order] || TRACK_ACTION_CONTENT[0]
  return {
    id,
    title: content.title,
    details: content.details,
    type: 'discussion',
    trackOrder: order,
    completionAction: 'button',
    completedAt: null,
    completionResponse: null,
    creator,
    groups: [{ id: TRACK_SPACE_ID, name: 'New Member Orientation', slug: 'new-member-orientation' }],
    groupsTotal: 1,
    createdAt_offset: -86400 * (20 - order),
    updatedAt_offset: -86400 * (20 - order) + 3600,
    commentsTotal: 0,
    commentersTotal: 0,
    postReactionsTotal: 0,
    peopleReactedTotal: 0,
    followersTotal: 0,
    topicsTotal: 0,
    isPublic: false,
    announcement: false,
    attachments: [],
    comments: { items: [], total: 0, hasMore: false },
    completionResponses: { items: [], total: 0, hasMore: false }
  }
}
