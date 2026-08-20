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
 * All sandbox posts. Keys: mainStream, chatSpace, fundingSubmissions, simpleGroupChat, simpleGroupStream.
 * Populated with real Terran Collective content.
 */
export function buildPosts (peopleById, meId) {
  const me = peopleById[meId]
  const p003 = peopleById[sid('person', '003')]
  const p004 = peopleById[sid('person', '004')]
  const p005 = peopleById[sid('person', '005')]
  const p006 = peopleById[sid('person', '006')]
  const p007 = peopleById[sid('person', '007')]
  const p008 = peopleById[sid('person', '008')]
  const p009 = peopleById[sid('person', '009')]
  const p010 = peopleById[sid('person', '010')]
  const p011 = peopleById[sid('person', '011')]
  const p012 = peopleById[sid('person', '012')]
  const p013 = peopleById[sid('person', '013')]
  const p014 = peopleById[sid('person', '014')]
  const p015 = peopleById[sid('person', '015')]
  const p016 = peopleById[sid('person', '016')]
  const p017 = peopleById[sid('person', '017')]
  const p018 = peopleById[sid('person', '018')]

  return {
    mainStream: [
      // discussion — community forest crowdfunding (announcement, 12 comments)
      discussionPost('001', me, MAIN_GROUP_ID, -86400 * 14, {
        title: 'Crowdfunding the East Bay Community Forest!',
        details: '<p>Today&#39;s the big day — we&#39;re launching our crowdfunding campaign for a community forest in the East Bay hills!</p><p>We are looking to raise $100k from our community as part of a larger land-stewardship push. The funds will help a neighborhood land trust secure a hillside parcel, plant a dense native canopy, and keep the land in community care for the long haul.</p><p>Please join us and contribute here: https://www.flipcause.com/secure/cause_pdetails/east-bay-community-forest</p><p>In solidarity,<br/>Maya, Kai, Neha, Elena<br/>Terran Coordinators</p>',
        announcement: true,
        commentCount: 12,
        reactionCount: 10
      }),
      // discussion — what would you spend $5 million on (37 comments)
      discussionPost('002', me, MAIN_GROUP_ID, -86400 * 10, {
        title: 'What would you spend $5 million on?',
        details: '<p>If you had $5 million to give away right now, with the goal being to create the most positive change in the world, what/who would you give it to? The rules:</p><p>1. You can split the money up to any number of organizations, projects, or individuals.</p><p>2. Financial ROI cannot be a consideration, only impact.</p><p>3. You cannot choose your own organization(s) or project(s)</p><p>Let&#39;s see what we can crowdsource in terms of groups out there doing the most important work of our time!</p>',
        commentCount: 37,
        reactionCount: 8
      }),
      // event — Bay Area Regen CoLab: Permaculture w/ Kevin Bayuk
      eventPost('003', me, MAIN_GROUP_ID, -86400 * 8, {
        title: 'Bay Area Regen CoLab - Permaculture w/ Kevin Bayuk',
        details: '<p>The permaculture movement has deep roots in the San Francisco Bay Area bioregion. For July&#39;s Bay Area Regen CoLab, we&#39;ll hear from respected permaculture instructor Kevin Bayuk on the story of permaculture in the Bay Area, accompanying an interactive overview of permaculture design.</p><p>Kevin works at the intersection of ecology and economy, where permaculture design meets cooperative organizations intent on meeting human needs while enhancing the conditions conducive to all life.</p>',
        location: 'https://us02web.zoom.us/j/86175972332',
        upcoming: true,
        commentCount: 6,
        reactionCount: 3
      }),
      // event — A Gathering of Stories
      eventPost('004', p003, MAIN_GROUP_ID, -86400 * 20, {
        title: 'A Gathering of Stories - The Heart of the Feminine',
        details: '<p>On July 31 2021, join us for our next live experience of storytellers, musicians, poets and movement artists.</p><p>Guided by co-hosts Pulxaneeks and Tonye Aganaba, the day will weave a mythopoetic tapestry of wonder. After each story, the audience will be invited to dive deeper with a shared conversation with the teller.</p><p>https://www.agatheringofstories.com</p>',
        location: 'https://www.agatheringofstories.com',
        upcoming: false,
        commentCount: 0
      }),
      // proposal — community decision
      proposalPost('005', me, MAIN_GROUP_ID, -86400 * 12, {
        title: 'Consensus: Shift Hylo stewardship model to member-owned cooperative',
        details: '<p>We propose to formally transition Terran Collective\'s stewardship of Hylo to a multi-stakeholder cooperative model, giving members a formal voice in governance and product direction. This would mean drafting bylaws, establishing a member council, and beginning the process of legal entity formation.</p>',
        voting: true
      }),
      // request — Rights of Nature (9 comments)
      requestPost('006', p004, MAIN_GROUP_ID, -86400 * 6, {
        title: 'Rights of Nature for the San Francisco Bay Delta',
        details: '<p>I live in Berkeley and I&#39;m interested in connecting with efforts to protect the Bay Area watershed, particularly a campaign to grant it legal rights. Does anyone here know about an effort like that?</p><p>The Bay faces many threats, like agricultural runoff and freshwater diversion schemes. I know that local tribes and conservation groups are fighting this — let&#39;s connect and start a rights of nature campaign!</p>',
        commentCount: 9
      }),
      // offer — Join the Hylo stewardship team (3 comments)
      offerPost('007', p005, MAIN_GROUP_ID, -86400 * 5, {
        title: 'Join the Hylo stewardship team!',
        details: '<p>Terran Collective is hiring for two roles to support Hylo&#39;s growth: a Stakeholder Advocate and an Operations Coordinator. These two roles will be critical to help us channel the energy of everyone wanting to participate in this open-source project.</p><p>Learn more and apply here &gt; https://medium.com/terran-collective/terran-collective-is-hiring-for-hylo-53e4abd0d4b8</p>',
        commentCount: 3
      }),
      // discussion — maximum wage ratio (6 comments)
      discussionPost('008', me, MAIN_GROUP_ID, -86400 * 4, {
        title: 'Maximum wage ratio',
        details: '<p>I strongly believe there should be a reasonable ratio between the highest income in our society and the lowest. I&#39;d say something like 20-1 makes sense to me. So if a minimum wage job earns someone $20k / year, then the maximum wage would be $400k / year. What would be your ratio?</p>',
        commentCount: 6,
        reactionCount: 2
      }),
      // resource — How can we create communities as nature?
      discussionPost('009', p006, MAIN_GROUP_ID, -86400 * 3, {
        title: 'How can we create communities as nature?',
        details: '<p>Creating communities that are compatible with nature&#39;s processes for sustaining life requires basic ecological knowledge. We need to teach fundamental facts of life:</p><p>• Matter cycles continually through the web of life.<br/>• Most energy driving ecological cycles flows from the sun.<br/>• Diversity assures resilience.<br/>• One species&#39; waste is another species&#39; food.<br/>• Life did not take over the planet by combat but by networking.</p><p>https://www.ecoliteracy.org/article/applying-ecological-principles</p>',
        commentCount: 0
      }),
      // proposal — discussion phase
      proposalPost('010', p007, MAIN_GROUP_ID, -86400 * 2, {
        title: 'Proposal: Host monthly community calls open to non-members',
        details: '<p>We propose opening our monthly community calls to interested non-members, giving prospective members a chance to experience Terran Collective culture before joining. This would increase visibility and help grow the community in an authentic way.</p>',
        discussionPhase: true
      }),
      // request — afforestation
      requestPost('011', p008, MAIN_GROUP_ID, -86400, {
        title: 'Afforestation in arid California',
        details: '<p>I watched this video about planting tiny forests (https://www.ted.com/talks/shubhendu_sharma_how_to_plant_a_tiny_forest_near_you) and want to connect with people in the Bay Area or ideally in arid parts of California who are knowledgeable about forest ecology and growing forests like these. Get in touch!</p>',
        commentCount: 1
      }),
      // resource — Integral Bioregionalism
      offerPost('012', p009, MAIN_GROUP_ID, -43200, {
        title: 'Integral Bioregionalism in the Bay Area',
        details: '<p>For anyone that missed it, here&#39;s the recording of the Bay Area Regen CoLab in June featuring Karie and a discussion of bioregionalism and reinhabitation education. Enjoy!</p><p>https://youtu.be/gEfFO3myb2c</p>',
        commentCount: 0
      })
    ],
    chatSpace: [
      chatPost('chat', '001', me, CHAT_SPACE_ID, -7200, 'Good morning everyone 🌱 What are you all working on this week?'),
      chatPost('chat', '002', p010, CHAT_SPACE_ID, -7000, 'Just finished the notes from Kevin Bayuk&#39;s permaculture session — will share in the stream shortly!'),
      chatPost('chat', '003', p011, CHAT_SPACE_ID, -6800, 'Reminder that the Rights of Nature zoom is tomorrow at noon PT. Link in the post.'),
      chatPost('chat', '004', p012, CHAT_SPACE_ID, -6600, 'Has anyone connected with the Bioneers community around watershed stewardship? They&#39;d be great allies.'),
      chatPost('chat', '005', me, CHAT_SPACE_ID, -6400, 'Yes! Thomas Linzey from their team reached out after my post. Setting up a call next week.'),
      chatPost('chat', '006', p013, CHAT_SPACE_ID, -6200, 'The community forest campaign is going really well — almost at 60% 🎉 Keep sharing!'),
      chatPost('chat', '007', p014, CHAT_SPACE_ID, -6000, 'Anyone up for a co-working session at the Oakland Collective on Friday?'),
      chatPost('chat', '008', p015, CHAT_SPACE_ID, -5800, 'I&#39;ll be there! See you around 10am.')
    ],
    fundingSubmissions: [
      fundingSubmission('001', p016, FUNDING_SPACE_ID, -86400 * 5, 24, {
        title: 'Bay Area Mycorrhizal Mapping Project',
        details: '<p>A community science initiative to map fungal networks across the Bay Area bioregion, partnering with urban farms, community gardens, and restoration projects to build a shared soil health database.</p>'
      }),
      fundingSubmission('002', p017, FUNDING_SPACE_ID, -86400 * 4, 18, {
        title: 'Regenerative Agriculture Education Series',
        details: '<p>A six-part online course connecting Bay Area farmers with permaculture designers and soil scientists, with a focus on transitioning conventional operations toward regenerative practices.</p>'
      }),
      fundingSubmission('003', p018, FUNDING_SPACE_ID, -86400 * 3, 22, {
        title: 'POC-Led Urban Farming Network',
        details: '<p>Seed funding to connect and resource BIPOC-led urban farming projects across Oakland, Richmond, and East Palo Alto — supporting land access, equipment sharing, and peer mentorship.</p>'
      })
    ],
    simpleGroupChat: [
      chatPost('simple', '001', me, SIMPLE_GROUP_ID, -3600, 'Morning eastbayconnect — anyone heading to Lake Merritt this afternoon?'),
      chatPost('simple', '002', peopleById[sid('person', 'starter', '001')], SIMPLE_GROUP_ID, -3400, 'I can be there around 4. Bringing leftover mandarins for the food share table.'),
      chatPost('simple', '003', peopleById[sid('person', 'starter', '002')], SIMPLE_GROUP_ID, -3200, 'If you need a hand setting up the twilight markets stall, I have a spare gazebo.'),
      chatPost('simple', '004', peopleById[sid('person', 'starter', '003')], SIMPLE_GROUP_ID, -3000, 'Love that. I&#39;ll post the Side by Side gathering dates in the stream today.'),
      chatPost('simple', '005', me, SIMPLE_GROUP_ID, -2800, 'Beautiful. Drop requests in the stream too — projector, skill-share, neighbour catch-ups, all welcome.'),
      chatPost('simple', '006', peopleById[sid('person', 'starter', '001')], SIMPLE_GROUP_ID, -2400, 'The resilience team meeting is Thursday at the Richmond Rec Center if anyone can make it.'),
      chatPost('simple', '007', peopleById[sid('person', 'starter', '002')], SIMPLE_GROUP_ID, -2000, 'RiverTracks still needs that projector for the launch — I&#39;ve posted a request in the stream.'),
      chatPost('simple', '008', peopleById[sid('person', 'starter', '003')], SIMPLE_GROUP_ID, -1600, 'Mandarins received! Left a bag of limes on the share table in return.')
    ],
    simpleGroupStream: [
      projectPost('simple-101', peopleById[sid('person', 'starter', '001')], SIMPLE_GROUP_ID, -86400 * 40, {
        title: 'Front Fence Free Food Share',
        details: '<p>Front Fence Free Food Share is about sharing our home grown produce with each other. It inspires our generosity, connects our community, and increases our access to fresh, local, organic fruit and veg!</p><p>FFFFS will soon be giving away 100 fruit trees as part of Fenceline Fruit. The trees are to be planted along people&#39;s front fenceline, and once the fruit is ready to pick, passers by can share in the bounty.</p><p>If you already have fruit growing along your fenceline, you can be part of the movement too. A pot of herbs will do the job!</p><p>Happy Food Sharing!!</p>',
        commentCount: 1,
        reactionCount: 2
      }),
      projectPost('simple-102', peopleById[sid('person', 'starter', '001')], SIMPLE_GROUP_ID, -86400 * 36, {
        title: 'Oakland Twilight Markets',
        details: '<p>Let&#39;s get Twilight Markets happening around Lake Merritt — so much of the community is behind it! If you have skills, resources, support, or enthusiasm to put in, connect up here and we will make it happen together.</p>',
        commentCount: 8,
        reactionCount: 4
      }),
      projectPost('simple-103', peopleById[sid('person', 'starter', '003')], SIMPLE_GROUP_ID, -86400 * 34, {
        title: 'Side by Side',
        details: '<p>Would you like to live in a more connected and supportive neighbourhood? It Takes a Town&#39;s Side by Side project supports us to build closer connections with our neighbours, and helps develop a stronger sense of community.</p><p>Through regular social gatherings, neighbours are encouraged to know each other. Friendships form, people help each other, kids find nearby playmates, and important matters that affect the area can be discussed and shared.</p><p>Side by Side will be delivered in Richmond, El Cerrito, Fruitvale and Downtown Oakland over the coming months — we&#39;d love to hear from anyone living in these areas that would like to get involved.</p>',
        commentCount: 2,
        reactionCount: 1
      }),
      projectPost('simple-104', peopleById[sid('person', 'starter', '003')], SIMPLE_GROUP_ID, -86400 * 33, {
        title: 'Oakland Life',
        details: '<p>Would you like to see the Oakland community more connected, informed and part of a shared local culture? Oakland Life is a working group that came out of the It Takes a Town Reset Workshop with the aim of doing just this. We have recently set up the Oakland Life events calendar and are working on a welcome pack and welcome events for new and old community members.</p><p>Comment below or send a message if you want to get involved.</p>',
        commentCount: 0
      }),
      resourcePost('simple-105', peopleById[sid('person', 'starter', '002')], SIMPLE_GROUP_ID, -86400 * 45, {
        title: 'Studio Space Hire',
        details: '<p>Bright Hearts Imaginarium is a cosy boutique room available to hire Wed, Thu, Fri. Located next to Farley&#39;s on Grand this street front space has disability access, aircon and a small kitchenette. Furnished with a large farm work table, cosy couches and oodles of charm — perfect for a therapist, meetings, arts workshop, discussion groups, photographers. $15/hr, charities by donation.</p><p>Message Finn to enquire.</p>',
        commentCount: 2,
        reactionCount: 2
      }),
      offerPost('simple-106', peopleById[sid('person', 'starter', '003')], SIMPLE_GROUP_ID, -86400 * 32, {
        title: 'Temescal organic skin care facials',
        details: '<p>Organic facials in Temescal — currently running a heavily discounted promotion at $60 / hr. Message me to book in.</p>',
        commentCount: 4
      }),
      requestPost('simple-107', me, SIMPLE_GROUP_ID, -86400 * 28, {
        title: 'Do you have a skill to share?',
        details: '<p>It Takes a Town is offering a free series of workshops on Monday mornings. We&#39;re seeking people with skills to share in a workshop format. We provide the venue, meet all costs and organise participants.</p><p>Do you have a skill that can be shared in a workshop setting? Examples: craft, sewing, fun exercise, mindfulness, clothes repair, using basic tools.</p>',
        commentCount: 6,
        reactionCount: 2
      }),
      requestPost('simple-108', me, SIMPLE_GROUP_ID, -86400 * 22, {
        title: 'Would you like to connect with an older person?',
        details: '<p>It Takes a Town supports older residents in the East Bay by linking them with people who have the time to meet up on a fortnightly basis for a coffee and/or an outing. Typically the people we support are seeking social connections and from time to time, help with things such as paperwork. If you have some time available and would like to know more, please get in touch.</p>',
        commentCount: 1
      }),
      discussionPost('simple-109', peopleById[sid('person', 'starter', '002')], SIMPLE_GROUP_ID, -86400 * 18, {
        title: 'Support the RiverTracks Crowdfund Campaign!',
        details: '<p>Our crowdfunding campaign has officially launched! Please follow the link below to make a tax-deductible donation so that we can demonstrate the impact of working with struggling young people in our community to connect them to animals, nature and practical skills.</p><p>Donate before the end of the month and every $1 will be matched by a generous donor.</p>',
        commentCount: 0,
        reactionCount: 1
      }),
      requestPost('simple-110', peopleById[sid('person', 'starter', '002')], SIMPLE_GROUP_ID, -86400 * 19, {
        title: 'Projector and screen needed',
        details: '<p>Hi folks, does anyone know where RiverTracks may be able to borrow a projector and screen for our launch? Thanks!</p>',
        commentCount: 1
      }),
      requestPost('simple-111', peopleById[sid('person', 'starter', '001')], SIMPLE_GROUP_ID, -86400 * 31, {
        title: 'Richmond & Surrounds Community Resilience Team',
        details: '<p>Looking for volunteers to help build connection and resilience in this area. Working with emergency responders in times of flood, fire and other situations.</p>',
        commentCount: 1,
        reactionCount: 1
      })
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
    groups: [{ id: groupId, name: groupId === MAIN_GROUP_ID ? 'Terran Collective' : 'East Bay Connect' }],
    groupsTotal: 1,
    commentsTotal: extras.commentCount || 0,
    commentersTotal: extras.commentCount || 0,
    postReactionsTotal: extras.reactionCount || 0,
    peopleReactedTotal: extras.reactionCount || 0,
    followersTotal: extras.commentCount || 0,
    topicsTotal: 0,
    isPublic: extras.isPublic || false,
    announcement: extras.announcement || false,
    ...extras.fields
  }
}

function discussionPost (num, creator, groupId, createdAt_offset, extras = {}) {
  const fields = {}
  if (extras.withLocation) {
    fields.location = extras.location || PLACEHOLDER_COPY.slice(0, 60)
    fields.locationObject = defaultLocationObject(sid('location', 'post', num))
  }
  return basePost(num, creator, groupId, createdAt_offset, 'discussion', { ...extras, fields })
}

function eventPost (num, creator, groupId, createdAt_offset, { upcoming, location, ...rest } = {}) {
  const start = upcoming ? 86400 * 5 : -86400 * 3
  const end = upcoming ? 86400 * 5 + 7200 : -86400 * 3 + 7200
  return basePost(num, creator, groupId, createdAt_offset, 'event', {
    ...rest,
    fields: {
      startTime_offset: start,
      endTime_offset: end,
      timezone: 'America/Los_Angeles',
      location: location || null,
      meetingLink: null,
      myEventResponse: upcoming ? 'yes' : null
    }
  })
}

function proposalPost (num, creator, groupId, createdAt_offset, { voting, discussionPhase, title, details } = {}) {
  return basePost(num, creator, groupId, createdAt_offset, 'proposal', {
    title,
    details,
    fields: {
      proposalStatus: voting ? 'voting' : (discussionPhase ? 'discussion' : 'voting'),
      votingMethod: voting ? 'consensus' : 'single',
      quorum: voting ? 60 : 20,
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

function projectPost (num, creator, groupId, createdAt_offset, extras = {}) {
  return basePost(num, creator, groupId, createdAt_offset, 'project', extras)
}

function resourcePost (num, creator, groupId, createdAt_offset, extras = {}) {
  return basePost(num, creator, groupId, createdAt_offset, 'resource', extras)
}

function chatPost (prefix, num, creator, groupId, createdAt_offset, text) {
  return basePost(`${prefix}-${num}`, creator, groupId, createdAt_offset, 'chat', {
    title: null,
    details: '<p>' + (text || PLACEHOLDER_COPY.slice(0, 140)) + '</p>'
  })
}

function fundingSubmission (num, creator, groupId, createdAt_offset, tokensAllocated, extras = {}) {
  return basePost(`fr-${num}`, creator, groupId, createdAt_offset, 'project', {
    title: extras.title,
    details: extras.details,
    fields: {
      budget: '$5,000',
      fundingRound: { id: FUNDING_ROUND_ID, title: 'Bioregional Grants Round 1' },
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
      if (byId[post.id]) {
        throw new Error(`Duplicate sandbox post id ${post.id} (${byId[post.id].title || byId[post.id].type} / ${post.title || post.type})`)
      }
      byId[post.id] = post
    }
  }
  return byId
}
