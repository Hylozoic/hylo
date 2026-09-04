import {
  MAIN_GROUP_MEMBER_COUNT,
  MAIN_GROUP_SLUG,
  SIMPLE_GROUP_SLUG,
  STAFF_GROUP_SLUG
} from '../constants'
import { bayLocation, sid } from '../helpers'
import { ME_ID } from './people'

export const MAIN_GROUP_ID = sid('group', 'main')
export const SIMPLE_GROUP_ID = sid('group', 'simple')
export const STAFF_GROUP_ID = sid('group', 'staff')
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
      name: 'Terran Collective',
      description: 'Terran Collective is a community of care and practice. We are technologists, community organizers, entrepreneurs, activists, and artists with a vision for all beings thriving.\n\nOur mission is to amplify cooperation among people working to regenerate our communities and our planet. We do this by building systems and tools that foster trust and collaboration, starting in the Bay Area bioregion.\n\nLearn more about our scopes of practice at terran.io',
      purpose: 'Amplify cooperation among people working to regenerate our communities and our planet.',
      avatarUrl: 'https://d3ngex8q79bk55.cloudfront.net/evo-uploads/user/7650/communityAvatar/4009/67693087_721022015049461_910517523265355776_o.jpg',
      bannerUrl: 'https://d3ngex8q79bk55.cloudfront.net/evo-uploads/user/7650/communityBanner/4009/67691464_10102112860412601_1245997620619378688_o-2.jpg',
      icon: 'Users',
      type: null,
      parentId: null,
      memberCount: MAIN_GROUP_MEMBER_COUNT,
      postCount: 12,
      visibility: 2,
      accessibility: 1,
      canAccess: true,
      allowInPublic: true,
      paywall: false,
      location: 'Downtown Oakland, California, United States',
      locationObject: bayLocation(mainLocationId, {
        fullText: 'Downtown Oakland, California, United States',
        city: 'Oakland',
        lat: 37.8044,
        lng: -122.2712
      }),
      homeRoute: '/stream',
      stewardDescriptor: 'Coordinator',
      stewardDescriptorPlural: 'Coordinators',
      createdAt_offset: -86400 * 180,
      acceptedPostTypes: ['discussion', 'event', 'proposal', 'request', 'offer', 'project', 'resource'],
      settings: {
        showSuggestedSkills: true,
        showWelcomePage: false,
        layout: 'default'
      }
    },
    simple: {
      id: SIMPLE_GROUP_ID,
      slug: SIMPLE_GROUP_SLUG,
      name: 'East Bay Connect',
      description: 'East Bay Connect is a space for everyone in our community to get great stuff happening.\n\nAs part of the vision of the It Takes A Town movement, East Bay Connect\'s goal is to create a culture where sharing, generosity and responsiveness to each other is the norm. When everyone is contributing according to their abilities, resources and skills, our community becomes a richer and more connected place for us all. This is a safe, respectful community space for everyone in the East Bay.',
      purpose: 'Create a culture where sharing, generosity and responsiveness is the norm.',
      avatarUrl: 'https://d3ngex8q79bk55.cloudfront.net/evo-uploads/user/29919/communityAvatar/5649/2484%20Connect%20%282%29.png',
      bannerUrl: 'https://d3ngex8q79bk55.cloudfront.net/evo-uploads/user/29919/communityBanner/5649/Joanna%20May%20Wollumbin%20photo%202020_vivid50.jpg',
      icon: 'Sprout',
      type: null,
      parentId: null,
      memberCount: 48,
      postCount: 19,
      visibility: 2,
      accessibility: 2,
      canAccess: true,
      allowInPublic: true,
      paywall: false,
      homeRoute: '/chat',
      location: 'Berkeley, California, United States',
      locationObject: bayLocation(sid('location', 'simple'), {
        fullText: 'Berkeley, California, United States',
        city: 'Berkeley',
        lat: 37.8715,
        lng: -122.2730
      }),
      stewardDescriptor: 'Organizer',
      stewardDescriptorPlural: 'Organizers',
      createdAt_offset: -86400 * 200,
      acceptedPostTypes: ['chat', 'discussion', 'request', 'offer', 'project', 'resource', 'event'],
      settings: {
        showSuggestedSkills: false,
        showWelcomePage: false,
        layout: 'default'
      }
    },
    staff: {
      id: STAFF_GROUP_ID,
      slug: STAFF_GROUP_SLUG,
      name: 'Holistica Staff',
      description: 'Together, we use this space to coordinate our skills and resources as worker-owners at Holistica — a small cooperative that hosts neighborhood gatherings, skill-shares, and facilitation for groups who want help working together in person.',
      purpose: 'Coordinate shared work as a small workers cooperative.',
      avatarUrl: 'https://hylo-staging.s3.amazonaws.com/evo-uploads/user/41415/groupAvatar/37887/logoipsum-429.png',
      bannerUrl: 'https://d3ngex8q79bk55.cloudfront.net/evo-uploads/user/16325/communityBanner/29/ethereal.jpg',
      icon: 'HeartHandshake',
      type: null,
      parentId: null,
      memberCount: 8,
      postCount: 13,
      visibility: 1,
      accessibility: 1,
      canAccess: true,
      allowInPublic: true,
      paywall: false,
      homeRoute: '/chat',
      location: 'Temescal, Oakland, California, United States',
      locationObject: bayLocation(sid('location', 'staff'), {
        fullText: 'Temescal, Oakland, California, United States',
        city: 'Oakland',
        lat: 37.8370,
        lng: -122.2623
      }),
      stewardDescriptor: 'Worker-owner',
      stewardDescriptorPlural: 'Worker-owners',
      createdAt_offset: -86400 * 400,
      acceptedPostTypes: ['chat', 'discussion', 'request', 'offer', 'project', 'resource', 'event'],
      settings: {
        showSuggestedSkills: false,
        showWelcomePage: false,
        layout: 'default'
      }
    },
    spaces: {
      chat: {
        id: CHAT_SPACE_ID,
        slug: 'general',
        name: 'General',
        description: 'The main chat channel for Terran Collective — share news, updates, and anything on your mind.',
        purpose: 'Open conversation for the whole community.',
        avatarUrl: null,
        bannerUrl: null,
        icon: 'MessageCircle',
        type: 'space',
        parentId: MAIN_GROUP_ID,
        memberCount: 20,
        postCount: 8,
        visibility: 0,
        accessibility: 1,
        homeRoute: '/chat',
        createdAt_offset: -86400 * 90,
        acceptedPostTypes: ['chat']
      },
      track: {
        id: TRACK_SPACE_ID,
        slug: 'new-member-orientation',
        name: 'New Member Orientation',
        description: 'A guided onboarding track to help new members get oriented in Terran Collective — learn our tools, culture, and how to get involved.',
        purpose: 'Help new members find their footing and their people.',
        avatarUrl: null,
        bannerUrl: null,
        icon: 'Shapes',
        type: 'space',
        parentId: MAIN_GROUP_ID,
        memberCount: 11,
        postCount: 5,
        visibility: 0,
        accessibility: 1,
        homeRoute: '/track-actions',
        createdAt_offset: -86400 * 60,
        acceptedPostTypes: []
      },
      funding: {
        id: FUNDING_SPACE_ID,
        slug: 'bioregional-grants',
        name: 'Bioregional Grants',
        description: '<p>Participatory grants for regenerative work in the Bay Area bioregion. Members propose projects, discuss them openly, and allocate <strong>Regen Tokens</strong> through community voting — no grant committee, just collective stewardship of shared resources.</p><p>Round 1 is now in the voting phase. Browse submissions, read the plans, and allocate your tokens to the work you believe will heal people, land, and watersheds here.</p>',
        purpose: 'Channel community resources toward the highest-impact regenerative work through participatory budgeting.',
        avatarUrl: 'https://d3ngex8q79bk55.cloudfront.net/community/1054/avatar/1439885454281_BF_logo_final.jpg',
        bannerUrl: 'https://d3ngex8q79bk55.cloudfront.net/community/1054/banner/1439885439995_BF-Logo_W.jpg',
        icon: 'Coins',
        type: 'space',
        parentId: MAIN_GROUP_ID,
        memberCount: 8,
        postCount: 5,
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
        name: 'Coordinator',
        emoji: '🪄',
        active: true,
        groupId: MAIN_GROUP_ID,
        responsibilities: { items: [] }
      },
      {
        id: MAIN_MEMBER_ROLE_ID,
        name: 'Member',
        emoji: '🌱',
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
        canAccess: true,
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
        canAccess: true,
        settings: groups.simple.settings,
        childGroups: { items: [] }
      }
    },
    {
      id: sid('membership', 'staff'),
      lastViewedAt_offset: -5400,
      navOrder: 2,
      newPostCount: 2,
      person: { id: ME_ID },
      settings: {
        agreementsAcceptedAt_offset: -86400 * 10,
        digestFrequency: 'daily',
        joinQuestionsAnsweredAt_offset: -86400 * 10,
        postNotifications: 'all',
        sendEmail: true,
        sendPushNotifications: true,
        showJoinForm: false
      },
      group: {
        id: groups.staff.id,
        slug: groups.staff.slug,
        name: groups.staff.name,
        avatarUrl: groups.staff.avatarUrl,
        bannerUrl: groups.staff.bannerUrl,
        icon: groups.staff.icon,
        type: groups.staff.type,
        parentId: groups.staff.parentId,
        memberCount: groups.staff.memberCount,
        homeRoute: groups.staff.homeRoute,
        stewardDescriptor: groups.staff.stewardDescriptor,
        stewardDescriptorPlural: groups.staff.stewardDescriptorPlural,
        allowInPublic: groups.staff.allowInPublic,
        acceptedPostTypes: groups.staff.acceptedPostTypes,
        canAccess: true,
        settings: groups.staff.settings,
        childGroups: { items: [] }
      }
    },
    ...['chat', 'track', 'funding'].map((key, index) => {
      const space = groups.spaces[key]
      return {
        id: sid('membership', key),
        lastViewedAt_offset: -3600 - index * 60,
        navOrder: null,
        newPostCount: 0,
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
          id: space.id,
          slug: space.slug,
          name: space.name,
          avatarUrl: space.avatarUrl,
          bannerUrl: space.bannerUrl,
          icon: space.icon,
          type: space.type,
          parentId: space.parentId,
          memberCount: space.memberCount,
          homeRoute: space.homeRoute,
          allowInPublic: false,
          acceptedPostTypes: space.acceptedPostTypes,
          canAccess: true,
          settings: { layout: 'default' },
          childGroups: { items: [] }
        }
      }
    })
  ]
}

/**
 * Context menu / groupViews for the main group (stream, map, spaces, etc.).
 */
export function buildGroupViews (groups, track, fundingRound) {
  const { main, spaces } = groups
  return {
    [main.id]: [
      viewItem(sid('view', 'stream'), 'stream', 'Stream', 0, { icon: 'LayoutList' }),
      viewItem(sid('view', 'map'), 'map', 'Map', 1, { icon: 'Map' }),
      viewItem(sid('view', 'events'), 'events', 'Events', 2, { icon: 'Calendar' }),
      viewItem(sid('view', 'members'), 'members', 'Members', 3, { icon: 'Users' }),
      spaceViewItem(sid('view', 'chat-space'), spaces.chat, 4),
      spaceViewItem(sid('view', 'track-space'), spaces.track, 5, { track }),
      spaceViewItem(sid('view', 'funding-space'), spaces.funding, 6, { fundingRound })
    ],
    [spaces.chat.id]: [
      viewItem(sid('view', 'chat-main'), 'chat', 'Chat', 0, { icon: 'MessageCircle' })
    ],
    [spaces.track.id]: [
      viewItem(sid('view', 'track-actions'), 'track-actions', 'Orientation Steps', 0, { icon: 'Shapes' }),
      viewItem(sid('view', 'track-chat'), 'chat', 'Chat', 1, { icon: 'MessageCircle' }),
      viewItem(sid('view', 'track-members'), 'members', 'Members', 2, { icon: 'Users' })
    ],
    [spaces.funding.id]: [
      viewItem(sid('view', 'fr-submissions'), 'funding-round-submissions', 'Grant Submissions', 0, { icon: 'Coins' })
    ],
    [groups.simple.id]: [
      viewItem(sid('view', 'simple-chat'), 'chat', 'Chat', 0, { icon: 'MessageCircle' }),
      viewItem(sid('view', 'simple-all'), 'all', 'All Activity', 1, { icon: 'LayoutList' }),
      viewItem(sid('view', 'simple-requests'), 'requests-and-offers', 'Requests & Offers', 2, { icon: 'HandHeart' }),
      viewItem(sid('view', 'simple-projects'), 'projects', 'Projects', 3, { icon: 'Layers' }),
      viewItem(sid('view', 'simple-members'), 'members', 'Members', 4, { icon: 'Users' })
    ],
    [groups.staff.id]: [
      viewItem(sid('view', 'staff-chat'), 'chat', 'Chat', 0, { icon: 'MessageCircle' }),
      viewItem(sid('view', 'staff-all'), 'all', 'All Activity', 1, { icon: 'LayoutList' }),
      viewItem(sid('view', 'staff-requests'), 'requests-and-offers', 'Requests & Offers', 2, { icon: 'HandHeart' }),
      viewItem(sid('view', 'staff-events'), 'events', 'Events', 3, { icon: 'Calendar' }),
      viewItem(sid('view', 'staff-members'), 'members', 'Members', 4, { icon: 'Users' })
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
  return viewItem(id, 'space', space.name, order, {
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
