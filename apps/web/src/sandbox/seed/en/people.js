import { PLACEHOLDER_COPY, PLACEHOLDER_NAME } from '../constants'
import { personStub, sid } from '../helpers'

export const ME_ID = sid('me')

const AVATAR_BASE = 'https://www.untitledui.com/images/avatars'

/** Returns a webp avatar URL from the Untitled UI free avatar set */
function av (slug) {
  return AVATAR_BASE + '/' + slug + '?w=288&h=288&q=75&fm=webp'
}

/**
 * Sandbox Me — coordinator of Terran Collective (fictional demo persona).
 * Fields mirror MeQuery / checkLogin shapes used at bootstrap.
 */
export function buildMe () {
  return {
    id: ME_ID,
    isAdmin: false,
    name: 'Elena Vasquez',
    avatarUrl: av('candice-wu'),
    bannerUrl: 'https://d3ngex8q79bk55.cloudfront.net/evo-uploads/user/7650/communityBanner/4009/67691464_10102112860412601_1245997620619378688_o-2.jpg',
    createdAt_offset: -86400 * 365,
    hasRegistered: true,
    emailValidated: true,
    email: 'demo@example.com',
    newNotificationCount: 4,
    unseenThreadCount: 1,
    location: 'Oakland, California, United States',
    locationObject: null,
    bio: 'Community organizer and technologist working toward a more regenerative Bay Area bioregion. Coordinator at Terran Collective.',
    tagline: 'Bioregional coordinator',
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
      mapBaseLayer: 'streets-v12',
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

const REAL_PEOPLE = [
  {
    id: sid('person', '002'),
    name: 'Maya Reyes',
    avatarUrl: av('ava-wright'),
    bio: null,
    tagline: null,
    location: 'Vermont, United States',
    staffGroup: true
  },
  {
    id: sid('person', '003'),
    name: 'Kai Nakamura',
    avatarUrl: av('blake-riley'),
    bio: 'Regenerative engineering and communication in mixed realities.',
    tagline: 'Breath',
    location: 'Berlin',
    staffGroup: true
  },
  {
    id: sid('person', '004'),
    name: 'Liam Okafor',
    avatarUrl: av('lyle-kauffman'),
    bio: 'Working on how to use maps, apps, stories to build networks and local communities',
    tagline: 'Socialreporter',
    location: 'Greater London, England, United Kingdom',
    staffGroup: true
  },
  {
    id: sid('person', '005'),
    name: 'Farida Osei',
    avatarUrl: av('lana-steiner'),
    bio: 'Utopian Strategist — Circular Economy Enthusiast. World Fair Advocate.',
    tagline: '',
    location: 'Seattle, Washington',
    staffGroup: true
  },
  {
    id: sid('person', '006'),
    name: 'Rafael Morales',
    avatarUrl: av('koray-okumus'),
    bio: null,
    tagline: null,
    location: 'Kodiak, Alaska, United States'
  },
  {
    id: sid('person', '007'),
    name: 'Soren Weiss',
    avatarUrl: av('maxwell-tan'),
    bio: 'Social entrepreneur. Ph.D in Social computing and collaboration software.',
    tagline: null,
    location: 'San Francisco, USA'
  },
  {
    id: sid('person', '008'),
    name: 'Marcus Tran',
    avatarUrl: av('marvin-robbins'),
    bio: null,
    tagline: null,
    location: 'Berkeley, California'
  },
  {
    id: sid('person', '009'),
    name: 'Amara Diallo',
    avatarUrl: av('amelie-laurent'),
    bio: null,
    tagline: null,
    location: 'Richmond, California'
  },
  {
    id: sid('person', '010'),
    name: 'Ezra Feldman',
    avatarUrl: av('ethan-campbell'),
    bio: null,
    tagline: null,
    location: 'Oakland, California, United States',
    staffGroup: true
  },
  {
    id: sid('person', '011'),
    name: 'Jordan Osei',
    avatarUrl: av('rory-huff'),
    bio: null,
    tagline: null,
    location: 'Sacramento, California, United States'
  },
  {
    id: sid('person', '012'),
    name: 'Diego Herrera',
    avatarUrl: av('nicolas-trevino'),
    bio: null,
    tagline: 'If all are better, we are better.',
    location: 'Mexico City, Mexico'
  },
  {
    id: sid('person', '013'),
    name: 'Marco Vidal',
    avatarUrl: av('marco-gross'),
    bio: 'Experience designer and community organizer. Co-founder of an award-winning VR studio. Now a full time food artist — creating rituals around food, crafting stories to engage and create wonder.',
    tagline: 'The future is always first an idea',
    location: null
  },
  {
    id: sid('person', '014'),
    name: 'Owen Brennan',
    avatarUrl: av('phoenix-baker'),
    bio: null,
    tagline: null,
    location: null
  },
  {
    id: sid('person', '015'),
    name: 'Nadia Kovac',
    avatarUrl: av('pippa-wilkinson'),
    bio: null,
    tagline: null,
    location: 'Rhode Island'
  },
  {
    id: sid('person', '016'),
    name: 'Lucia Mendez',
    avatarUrl: av('rhea-levine'),
    bio: null,
    tagline: null,
    location: 'King City, California, United States'
  },
  {
    id: sid('person', '017'),
    name: 'Priya Anand',
    avatarUrl: av('kaitlin-hale'),
    bio: null,
    tagline: null,
    location: 'Easthampton, MA'
  },
  {
    id: sid('person', '018'),
    name: 'Yuki Tanaka',
    avatarUrl: av('natali-craig'),
    bio: null,
    tagline: null,
    location: 'Austin, Texas, United States'
  },
  {
    id: sid('person', '019'),
    name: 'Conrad Bauer',
    avatarUrl: av('levi-rocha'),
    bio: null,
    tagline: null,
    location: 'Shutesbury, Massachusetts, United States'
  },
  {
    id: sid('person', '020'),
    name: 'Tobias Strand',
    avatarUrl: av('scott-clayton'),
    bio: null,
    tagline: null,
    location: 'Grass Valley, California, United States'
  }
]

/**
 * Real-ish Terran Collective members (19 people with Untitled UI avatars) plus starters for the simple group.
 */
export function buildPeople () {
  const people = REAL_PEOPLE.map((p, i) => ({
    ...p,
    createdAt_offset: -86400 * (30 + i + 1)
  }))

  // Fill remaining slots (021–045) with generic placeholders to preserve slot count
  for (let i = 21; i <= 45; i += 1) {
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

  // Three members for the East Bay Connect community group
  people.push({
    id: sid('person', 'starter', '001'),
    name: 'Cleo Santos',
    avatarUrl: av('olivia-rhye'),
    bio: 'Community builder in Oakland, helping neighbours share produce, skills and care.',
    starterGroup: true,
    createdAt_offset: -86400 * 3
  })
  people.push({
    id: sid('person', 'starter', '002'),
    name: 'Finn O\'Brien',
    avatarUrl: av('drew-cano'),
    bio: 'Maker and events volunteer around the East Bay. Helps out with RiverTracks and local markets.',
    starterGroup: true,
    createdAt_offset: -86400 * 2
  })
  people.push({
    id: sid('person', 'starter', '003'),
    name: 'Anjali Patel',
    avatarUrl: av('priya-shepard'),
    bio: 'Neighbourhood organiser in Fruitvale working on Side by Side gatherings and local welcome events.',
    starterGroup: true,
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

export { PLACEHOLDER_COPY, PLACEHOLDER_NAME }
