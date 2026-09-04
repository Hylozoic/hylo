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
    completionMessage: 'Congratulations — you\'ve completed the New Member Orientation! 🌱 You\'re now a full Terran. Welcome to the community. Jump into the chat, join a project, and don\'t hesitate to reach out to any of our Coordinators.',
    publishedAt_offset: -86400 * 30,
    accessControlled: false,
    canAccess: true,
    isEnrolled: true,
    didComplete: false,
    numPeopleEnrolled: 11,
    welcomeMessage: 'Take these steps at your own pace. Completing them is how you become a full Terran.',
    completionRole: {
      id: MAIN_COORDINATOR_ROLE_ID,
      name: 'Coordinator',
      emoji: '🪄'
    },
    numActions: 5,
    numPeopleCompleted: 12
  }
}

/** Ordered track action posts (type=action, each with a completion action). */
export function buildTrackActions (peopleById, meId) {
  const creator = peopleById[meId]
  return TRACK_ACTION_CONTENT.map((content, order) =>
    trackActionPost(sid('track-action', String(order + 1).padStart(3, '0')), order, creator, content)
  )
}

const TRACK_ACTION_CONTENT = [
  {
    title: 'Introduce yourself',
    details: 'Head to the General chat and write a short introduction — who you are, where you\'re from, and what brought you to Terran Collective. We love knowing what lights you up! 🌟',
    completionAction: 'comment',
    completionActionSettings: {
      instructions: 'Leave a comment here once you\'ve introduced yourself in chat.'
    }
  },
  {
    title: 'Explore the stream',
    details: 'Browse the main Stream to get a feel for the kinds of conversations, projects, and events happening in the community. React to something that resonates with you — emoji reactions are a great first step into the conversation.',
    completionAction: 'reaction',
    completionActionSettings: {
      instructions: 'React to this step with an emoji once you\'ve explored the stream.'
    }
  },
  {
    title: 'How do you want to get involved?',
    details: 'Terran is a bioregional community of practice. Pick the doorway that feels most true right now — you can always change course later.',
    completionAction: 'selectOne',
    completionActionSettings: {
      instructions: 'Select one option to complete this Orientation Step.',
      options: [
        'Land stewardship and restoration',
        'Community organizing and mutual aid',
        'Culture, gatherings, and story',
        'I\'m still exploring'
      ]
    }
  },
  {
    title: 'Skills and gifts you can share',
    details: 'What can you offer this season? Select every gift you\'re happy to bring — even a little time counts.',
    completionAction: 'selectMultiple',
    completionActionSettings: {
      instructions: 'Select one or more options to complete this Orientation Step.',
      options: [
        'Facilitation and hosting',
        'Growing food or tending soil',
        'Design, writing, or media',
        'Care work and community support'
      ]
    }
  },
  {
    title: 'You\'re ready to participate',
    details: 'That\'s the orientation. Mark this step complete when you\'re ready to jump into Terran as a full member — chat, projects, and coordinators are all open to you.',
    completionAction: 'button',
    completionActionSettings: {
      instructions: 'Click the button to mark this Orientation Step as complete.'
    }
  }
]

function trackActionPost (id, order, creator, content) {
  return {
    id,
    title: content.title,
    details: content.details,
    type: 'action',
    trackOrder: order,
    completionAction: content.completionAction,
    completionActionSettings: content.completionActionSettings,
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
