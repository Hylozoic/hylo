import {
  MAIN_GROUP_MEMBER_COUNT,
  MAIN_GROUP_SLUG,
  PLACEHOLDER_COPY,
  PLACEHOLDER_NAME,
  SIMPLE_GROUP_SLUG
} from '../constants'
import { defaultLocationObject, sid } from '../helpers'
import { ME_ID } from './people'

export const MAIN_GROUP_ID = sid('group', 'main')
export const SIMPLE_GROUP_ID = sid('group', 'simple')
export const CHAT_SPACE_ID = sid('space', 'chat')
export const TRACK_SPACE_ID = sid('space', 'track')
export const FUNDING_SPACE_ID = sid('space', 'funding')

export const MAIN_COORDINATOR_ROLE_ID = sid('role', 'coordinator')
export const MAIN_MEMBER_ROLE_ID = sid('role', 'member')

/**
 * Two top-level groups plus three spaces under the main group.
 */
export function buildGroups () {
  const mainLocationId = sid('location', 'main')

  return {
    main: {
      id: MAIN_GROUP_ID,
      slug: MAIN_GROUP_SLUG,
      name: PLACEHOLDER_NAME,
      description: PLACEHOLDER_COPY,
      purpose: PLACEHOLDER_COPY,
      avatarUrl: null,
      bannerUrl: null,
      icon: 'Users',
      type: null,
      parentId: null,
      memberCount: MAIN_GROUP_MEMBER_COUNT,
      postCount: 12,
      visibility: 0,
      accessibility: 1,
      allowInPublic: false,
      paywall: false,
      homeRoute: '/stream',
      location: PLACEHOLDER_COPY.slice(0, 60),
      locationObject: defaultLocationObject(mainLocationId),
      stewardDescriptor: 'Coordinator',
      stewardDescriptorPlural: 'Coordinators',
      createdAt_offset: -86400 * 180,
      acceptedPostTypes: ['discussion', 'event', 'proposal', 'request', 'offer', 'project', 'resource'],
      settings: {
        showSuggestedSkills: true,
        showWelcomePage: true,
        layout: 'default'
      }
    },
    simple: {
      id: SIMPLE_GROUP_ID,
      slug: SIMPLE_GROUP_SLUG,
      name: PLACEHOLDER_NAME,
      description: PLACEHOLDER_COPY,
      purpose: PLACEHOLDER_COPY,
      avatarUrl: null,
      bannerUrl: null,
      icon: 'Sprout',
      type: null,
      parentId: null,
      memberCount: 4,
      postCount: 5,
      visibility: 0,
      accessibility: 1,
      allowInPublic: false,
      paywall: false,
      homeRoute: '/chat',
      location: null,
      locationObject: null,
      stewardDescriptor: 'Moderator',
      stewardDescriptorPlural: 'Moderators',
      createdAt_offset: -86400 * 7,
      acceptedPostTypes: ['chat'],
      settings: {
        showSuggestedSkills: false,
        showWelcomePage: false,
        layout: 'default'
      }
    },
    spaces: {
      chat: {
        id: CHAT_SPACE_ID,
        slug: 'general-chat',
        name: PLACEHOLDER_NAME,
        description: PLACEHOLDER_COPY,
        purpose: PLACEHOLDER_COPY,
        avatarUrl: null,
        bannerUrl: null,
        icon: 'MessageCircle',
        type: 'space',
        parentId: MAIN_GROUP_ID,
        memberCount: MAIN_GROUP_MEMBER_COUNT,
        postCount: 8,
        visibility: 0,
        accessibility: 1,
        homeRoute: '/chat',
        createdAt_offset: -86400 * 90,
        acceptedPostTypes: ['chat']
      },
      track: {
        id: TRACK_SPACE_ID,
        slug: 'onboarding-track',
        name: PLACEHOLDER_NAME,
        description: PLACEHOLDER_COPY,
        purpose: PLACEHOLDER_COPY,
        avatarUrl: null,
        bannerUrl: null,
        icon: 'Route',
        type: 'space',
        parentId: MAIN_GROUP_ID,
        memberCount: MAIN_GROUP_MEMBER_COUNT,
        postCount: 0,
        visibility: 0,
        accessibility: 1,
        homeRoute: '/track-actions',
        createdAt_offset: -86400 * 60,
        acceptedPostTypes: ['discussion']
      },
      funding: {
        id: FUNDING_SPACE_ID,
        slug: 'spring-grants',
        name: PLACEHOLDER_NAME,
        description: PLACEHOLDER_COPY,
        purpose: PLACEHOLDER_COPY,
        avatarUrl: null,
        bannerUrl: null,
        icon: 'Coins',
        type: 'space',
        parentId: MAIN_GROUP_ID,
        memberCount: MAIN_GROUP_MEMBER_COUNT,
        postCount: 3,
        visibility: 0,
        accessibility: 1,
        homeRoute: '/funding-round-submissions',
        createdAt_offset: -86400 * 45,
        acceptedPostTypes: ['project']
      }
    },
    groupRoles: [
      {
        id: MAIN_COORDINATOR_ROLE_ID,
        name: PLACEHOLDER_NAME,
        emoji: '⭐',
        active: true,
        groupId: MAIN_GROUP_ID,
        responsibilities: { items: [] }
      },
      {
        id: MAIN_MEMBER_ROLE_ID,
        name: PLACEHOLDER_NAME,
        emoji: '👤',
        active: true,
        groupId: MAIN_GROUP_ID,
        responsibilities: { items: [] }
      }
    ]
  }
}

/**
 * Memberships on Me — main group (coordinator) + simple group.
 */
export function buildMemberships (groups) {
  return [
    {
      id: sid('membership', 'main'),
      lastViewedAt_offset: -3600,
      navOrder: 0,
      newPostCount: 3,
      person: { id: ME_ID },
      settings: {
        agreementsAcceptedAt_offset: -86400 * 30,
        digestFrequency: 'weekly',
        joinQuestionsAnsweredAt_offset: -86400 * 30,
        postNotifications: 'all',
        sendEmail: true,
        sendPushNotifications: true,
        showJoinForm: false
      },
      group: {
        id: groups.main.id,
        slug: groups.main.slug,
        name: groups.main.name,
        avatarUrl: groups.main.avatarUrl,
        bannerUrl: groups.main.bannerUrl,
        icon: groups.main.icon,
        type: groups.main.type,
        parentId: groups.main.parentId,
        memberCount: groups.main.memberCount,
        homeRoute: groups.main.homeRoute,
        stewardDescriptor: groups.main.stewardDescriptor,
        stewardDescriptorPlural: groups.main.stewardDescriptorPlural,
        allowInPublic: groups.main.allowInPublic,
        acceptedPostTypes: groups.main.acceptedPostTypes,
        settings: groups.main.settings,
        childGroups: {
          items: [
            {
              id: groups.spaces.chat.id,
              name: groups.spaces.chat.name,
              avatarUrl: null,
              slug: groups.spaces.chat.slug,
              visibility: 0,
              accessibility: 1
            },
            {
              id: groups.spaces.track.id,
              name: groups.spaces.track.name,
              avatarUrl: null,
              slug: groups.spaces.track.slug,
              visibility: 0,
              accessibility: 1
            },
            {
              id: groups.spaces.funding.id,
              name: groups.spaces.funding.name,
              avatarUrl: null,
              slug: groups.spaces.funding.slug,
              visibility: 0,
              accessibility: 1
            }
          ]
        }
      }
    },
    {
      id: sid('membership', 'simple'),
      lastViewedAt_offset: -7200,
      navOrder: 1,
      newPostCount: 1,
      person: { id: ME_ID },
      settings: {
        agreementsAcceptedAt_offset: -86400 * 5,
        digestFrequency: 'weekly',
        joinQuestionsAnsweredAt_offset: -86400 * 5,
        postNotifications: 'all',
        sendEmail: true,
        sendPushNotifications: false,
        showJoinForm: false
      },
      group: {
        id: groups.simple.id,
        slug: groups.simple.slug,
        name: groups.simple.name,
        avatarUrl: groups.simple.avatarUrl,
        bannerUrl: groups.simple.bannerUrl,
        icon: groups.simple.icon,
        type: groups.simple.type,
        parentId: groups.simple.parentId,
        memberCount: groups.simple.memberCount,
        homeRoute: groups.simple.homeRoute,
        stewardDescriptor: groups.simple.stewardDescriptor,
        stewardDescriptorPlural: groups.simple.stewardDescriptorPlural,
        allowInPublic: groups.simple.allowInPublic,
        acceptedPostTypes: groups.simple.acceptedPostTypes,
        settings: groups.simple.settings,
        childGroups: { items: [] }
      }
    }
  ]
}

/**
 * Context menu / groupViews for the main group (stream, map, spaces, etc.).
 */
export function buildGroupViews (groups, track, fundingRound) {
  const { main, spaces } = groups
  return {
    [main.id]: [
      viewItem(sid('view', 'stream'), 'stream', PLACEHOLDER_NAME, 0, { icon: 'LayoutList' }),
      viewItem(sid('view', 'map'), 'map', PLACEHOLDER_NAME, 1, { icon: 'Map' }),
      viewItem(sid('view', 'events'), 'events', PLACEHOLDER_NAME, 2, { icon: 'Calendar' }),
      viewItem(sid('view', 'members'), 'members', PLACEHOLDER_NAME, 3, { icon: 'Users' }),
      spaceViewItem(sid('view', 'chat-space'), spaces.chat, 4),
      spaceViewItem(sid('view', 'track-space'), spaces.track, 5, { track }),
      spaceViewItem(sid('view', 'funding-space'), spaces.funding, 6, { fundingRound })
    ],
    [spaces.chat.id]: [
      viewItem(sid('view', 'chat-main'), 'chat', PLACEHOLDER_NAME, 0, { icon: 'MessageCircle' })
    ],
    [spaces.track.id]: [
      viewItem(sid('view', 'track-actions'), 'track-actions', PLACEHOLDER_NAME, 0, { icon: 'Route' })
    ],
    [spaces.funding.id]: [
      viewItem(sid('view', 'fr-submissions'), 'funding-round-submissions', PLACEHOLDER_NAME, 0, { icon: 'Coins' })
    ],
    [groups.simple.id]: [
      viewItem(sid('view', 'simple-chat'), 'chat', PLACEHOLDER_NAME, 0, { icon: 'MessageCircle' })
    ]
  }
}

function viewItem (id, type, name, order, extras = {}) {
  return {
    id,
    type,
    name,
    order,
    icon: extras.icon || null,
    link: null,
    pageContent: null,
    topics: [],
    settings: {},
    newPostCount: extras.newPostCount || 0,
    lastReadPostId: null,
    linkedGroup: extras.linkedGroup || null,
    ...extras
  }
}

function spaceViewItem (id, space, order, extras = {}) {
  return viewItem(id, 'linkedGroup', space.name, order, {
    icon: space.icon,
    linkedGroup: {
      id: space.id,
      name: space.name,
      slug: space.slug,
      type: space.type,
      parentId: space.parentId,
      avatarUrl: space.avatarUrl,
      bannerUrl: space.bannerUrl,
      icon: space.icon,
      homeRoute: space.homeRoute,
      description: space.description,
      purpose: space.purpose,
      acceptedPostTypes: space.acceptedPostTypes,
      visibility: space.visibility,
      accessibility: space.accessibility,
      paywall: false,
      track: extras.track || null,
      fundingRound: extras.fundingRound || null,
      groupViews: { items: [] }
    }
  })
}
