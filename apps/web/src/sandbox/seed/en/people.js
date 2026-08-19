import { PLACEHOLDER_COPY, PLACEHOLDER_NAME } from '../constants'
import { htmlCopy, personStub, sid } from '../helpers'

export const ME_ID = sid('me')

/**
 * Sandbox Me — admin/coordinator of the main demo group.
 * Fields mirror MeQuery / checkLogin shapes used at bootstrap.
 */
export function buildMe () {
  return {
    id: ME_ID,
    isAdmin: false,
    name: PLACEHOLDER_NAME,
    avatarUrl: null,
    bannerUrl: null,
    createdAt_offset: -86400 * 365,
    hasRegistered: true,
    emailValidated: true,
    email: 'demo@example.com',
    newNotificationCount: 2,
    unseenThreadCount: 1,
    location: PLACEHOLDER_COPY.slice(0, 40),
    locationObject: null,
    bio: PLACEHOLDER_COPY,
    tagline: PLACEHOLDER_COPY.slice(0, 80),
    contactEmail: null,
    contactPhone: null,
    twitterName: null,
    linkedinUrl: null,
    facebookUrl: null,
    url: null,
    intercomHash: null,
    hasStripeAccount: false,
    rsvpCalendarUrl: null,
    settings: {
      alreadySeenTour: true,
      colorScheme: 'auto',
      dmNotifications: 'all',
      commentNotifications: 'all',
      locale: 'en',
      mapBaseLayer: 'streets',
      globalNavStyle: 'sidebar',
      groupNavStyle: 'sidebar',
      rsvpCalendarSub: null,
      signupInProgress: false,
      stackGroups: false,
      streamChildPosts: 'explore',
      streamViewMode: 'cards',
      streamSortBy: 'updated',
      streamPostType: null,
      theme: 'default'
    },
    joinRequests: { items: [] },
    groupRoles: { items: [] },
    skills: { items: [] },
    cookieConsentPreferences: null
  }
}

/**
 * 44 additional people for the main group (45 total with Me).
 * IDs sandbox-person-002 … sandbox-person-045.
 */
export function buildPeople () {
  const people = []
  for (let i = 2; i <= 45; i += 1) {
    const num = String(i).padStart(3, '0')
    people.push({
      id: sid('person', num),
      name: PLACEHOLDER_NAME,
      avatarUrl: null,
      bannerUrl: null,
      bio: PLACEHOLDER_COPY,
      tagline: PLACEHOLDER_COPY.slice(0, 80),
      location: null,
      createdAt_offset: -86400 * (30 + i)
    })
  }
  // A handful for the smaller “starter” group
  people.push({
    id: sid('person', 'starter', '001'),
    name: PLACEHOLDER_NAME,
    avatarUrl: null,
    bio: PLACEHOLDER_COPY,
    createdAt_offset: -86400 * 3
  })
  people.push({
    id: sid('person', 'starter', '002'),
    name: PLACEHOLDER_NAME,
    avatarUrl: null,
    bio: PLACEHOLDER_COPY,
    createdAt_offset: -86400 * 2
  })
  people.push({
    id: sid('person', 'starter', '003'),
    name: PLACEHOLDER_NAME,
    avatarUrl: null,
    bio: PLACEHOLDER_COPY,
    createdAt_offset: -86400
  })
  return people
}

/** Lookup map built after people list is assembled */
export function peopleById (people, me) {
  const map = { [me.id]: personStub(me.id, { name: me.name, avatarUrl: me.avatarUrl }) }
  for (const p of people) {
    map[p.id] = personStub(p.id, { name: p.name, avatarUrl: p.avatarUrl })
  }
  return map
}

export function meAsPerson (me) {
  return personStub(me.id, { name: me.name, avatarUrl: me.avatarUrl })
}

export { htmlCopy, PLACEHOLDER_COPY, PLACEHOLDER_NAME }
