import { PLACEHOLDER_COPY, PLACEHOLDER_NAME } from '../constants'
import { bayLocation, htmlCopy, sid } from '../helpers'
import {
  CHAT_SPACE_ID,
  FUNDING_SPACE_ID,
  MAIN_GROUP_ID,
  SIMPLE_GROUP_ID,
  STAFF_GROUP_ID
} from './groups'
import { FUNDING_ROUND_ID } from './fundingRounds'

/**
 * All sandbox posts. Keys: mainStream, chatSpace, fundingSubmissions, simpleGroupChat, simpleGroupStream.
 * Populated with demo content adapted from real Hylo communities.
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
  const p019 = peopleById[sid('person', '019')]
  const p020 = peopleById[sid('person', '020')]

  return {
    mainStream: [
      // discussion — community forest crowdfunding (announcement, 12 comments)
      discussionPost('001', me, MAIN_GROUP_ID, -86400 * 14, {
        title: 'Crowdfunding the East Bay Community Forest!',
        details: '<p>Today&#39;s the big day — we&#39;re launching our crowdfunding campaign for a community forest in the East Bay hills!</p><p>We are looking to raise $100k from our community as part of a larger land-stewardship push. The funds will help a neighborhood land trust secure a hillside parcel, plant a dense native canopy, and keep the land in community care for the long haul.</p><p>Please join us and contribute here: https://www.flipcause.com/secure/cause_pdetails/east-bay-community-forest</p><p>In solidarity,<br/>Maya, Kai, Neha, Elena<br/>Community Hub Coordinators</p>',
        announcement: true,
        commentCount: 12,
        reactionCount: 10,
        place: {
          fullText: 'East Bay hills, Oakland, California, United States',
          city: 'Oakland',
          lat: 37.8136,
          lng: -122.1661
        }
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
        details: '<p>We propose to formally transition Community Hub to a multi-stakeholder cooperative model, giving members a formal voice in governance and product direction. This would mean drafting bylaws, establishing a member council, and beginning the process of legal entity formation.</p>',
        voting: true
      }),
      // request — Rights of Nature (9 comments)
      requestPost('006', p004, MAIN_GROUP_ID, -86400 * 6, {
        title: 'Rights of Nature for the San Francisco Bay Delta',
        details: '<p>I live in Berkeley and I&#39;m interested in connecting with efforts to protect the Bay Area watershed, particularly a campaign to grant it legal rights. Does anyone here know about an effort like that?</p><p>The Bay faces many threats, like agricultural runoff and freshwater diversion schemes. I know that local tribes and conservation groups are fighting this — let&#39;s connect and start a rights of nature campaign!</p>',
        commentCount: 9,
        place: {
          fullText: 'Berkeley Marina, Berkeley, California, United States',
          city: 'Berkeley',
          lat: 37.8625,
          lng: -122.3136
        }
      }),
      // offer — Join the Hylo stewardship team (3 comments)
      offerPost('007', p005, MAIN_GROUP_ID, -86400 * 5, {
        title: 'Join the Hylo stewardship team!',
        details: '<p>Community Hub is hiring for two roles to support our growth: a Stakeholder Advocate and an Operations Coordinator. These two roles will be critical to help us channel the energy of everyone wanting to participate in our work.</p><p>Reply here or message a coordinator if you&#39;d like to apply.</p>',
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
        details: '<p>We propose opening our monthly community calls to interested non-members, giving prospective members a chance to experience Community Hub culture before joining. This would increase visibility and help grow the community in an authentic way.</p>',
        discussionPhase: true
      }),
      // request — afforestation
      requestPost('011', p008, MAIN_GROUP_ID, -86400, {
        title: 'Afforestation in arid California',
        details: '<p>I watched this video about planting tiny forests (https://www.ted.com/talks/shubhendu_sharma_how_to_plant_a_tiny_forest_near_you) and want to connect with people in the Bay Area or ideally in arid parts of California who are knowledgeable about forest ecology and growing forests like these. Get in touch!</p>',
        commentCount: 1,
        place: {
          fullText: 'Richmond, California, United States',
          city: 'Richmond',
          lat: 37.9358,
          lng: -122.3477
        }
      }),
      // resource — Integral Bioregionalism
      offerPost('012', p009, MAIN_GROUP_ID, -43200, {
        title: 'Integral Bioregionalism in the Bay Area',
        details: '<p>For anyone that missed it, here&#39;s the recording of the Bay Area Regen CoLab in June featuring Karie and a discussion of bioregionalism and reinhabitation education. Enjoy!</p><p>https://youtu.be/gEfFO3myb2c</p>',
        commentCount: 0,
        place: {
          fullText: 'Berkeley, California, United States',
          city: 'Berkeley',
          lat: 37.8716,
          lng: -122.2727
        }
      })
    ],
    hubChat: [
      chatPost('chat', '001', me, MAIN_GROUP_ID, -7200, 'Good morning everyone 🌱 What are you all working on this week?'),
      chatPost('chat', '002', p010, MAIN_GROUP_ID, -7000, 'Just finished the notes from Kevin Bayuk&#39;s permaculture session — will share in the stream shortly!'),
      chatPost('chat', '003', p011, MAIN_GROUP_ID, -6800, 'Reminder that the Rights of Nature zoom is tomorrow at noon PT. Link in the post.'),
      chatPost('chat', '004', p012, MAIN_GROUP_ID, -6600, 'Has anyone connected with the Bioneers community around watershed stewardship? They&#39;d be great allies.'),
      chatPost('chat', '005', me, MAIN_GROUP_ID, -6400, 'Yes! Thomas Linzey from their team reached out after my post. Setting up a call next week.'),
      chatPost('chat', '006', p013, MAIN_GROUP_ID, -6200, 'The community forest campaign is going really well — almost at 60% 🎉 Keep sharing!'),
      chatPost('chat', '007', p014, MAIN_GROUP_ID, -6000, 'Anyone up for a co-working session at the Oakland Collective on Friday?'),
      chatPost('chat', '008', p015, MAIN_GROUP_ID, -5800, 'I&#39;ll be there! See you around 10am.')
    ],
    chatSpace: [
      chatPost('intro', '001', p003, CHAT_SPACE_ID, -86400 * 12, 'Hi, I&#39;m Kai. I live in the East Bay and I&#39;m here for the people doing land stewardship together.'),
      chatPost('intro', '002', p004, CHAT_SPACE_ID, -86400 * 9, 'Liam. I build cooperative tools, and I&#39;m glad this community exists.'),
      chatPost('intro', '003', p008, CHAT_SPACE_ID, -86400 * 6, 'Marcus from Berkeley. Just joined — the community forest campaign is what pulled me in.'),
      chatPost('intro', '004', p009, CHAT_SPACE_ID, -86400 * 3, 'Amara, Richmond. I work on watershed care and I&#39;m looking for people to learn with.'),
      chatPost('intro', '005', me, CHAT_SPACE_ID, -86400, 'Welcome, everyone. I&#39;m Elena, one of the coordinators. Say hello whenever you arrive — we read these.')
    ],
    fundingSubmissions: [
      fundingSubmission('001', p016, FUNDING_SPACE_ID, -86400 * 5, 24, {
        title: 'Bay Area Mycorrhizal Mapping Project',
        budget: '$6,500',
        commentCount: 3,
        reactionCount: 5,
        details: '<p>A community science initiative to map fungal networks across the Bay Area bioregion. We partner with urban farms, community gardens, and creek restoration crews to sample soil, identify mycorrhizal species, and publish open data anyone can use.</p><p><strong>What we&#39;ll do with the grant:</strong></p><ul><li>Train 12 neighborhood soil stewards in field sampling</li><li>Build a shared map of soil health indicators across 8 sites</li><li>Host two public workshops on fungi and watershed resilience</li></ul><p>Led by Lucia Mendez with support from King City growers and East Bay restoration groups.</p>',
        place: {
          fullText: 'Albany, California, United States',
          city: 'Albany',
          lat: 37.8869,
          lng: -122.2977
        }
      }),
      fundingSubmission('002', p017, FUNDING_SPACE_ID, -86400 * 4, 18, {
        title: 'Regenerative Agriculture Education Series',
        budget: '$4,200',
        commentCount: 2,
        reactionCount: 3,
        details: '<p>A six-part learning series connecting Bay Area farmers with permaculture designers and soil scientists. Each session pairs a farm visit with a practical design lab — cover crops, compost systems, water retention, and cooperative marketing.</p><p>We&#39;re especially focused on operators who want to transition leased land toward regenerative practices without taking on debt. Sessions will be recorded and shared under a Creative Commons license.</p>',
        place: {
          fullText: 'Sunol, California, United States',
          city: 'Sunol',
          lat: 37.5944,
          lng: -121.8889
        }
      }),
      fundingSubmission('003', p018, FUNDING_SPACE_ID, -86400 * 3, 22, {
        title: 'POC-Led Urban Farming Network',
        budget: '$8,000',
        commentCount: 4,
        reactionCount: 6,
        details: '<p>Seed funding to connect and resource BIPOC-led urban farming projects across Oakland, Richmond, and East Palo Alto. The network coordinates equipment sharing, peer mentorship, and collective purchasing for soil amendments and irrigation supplies.</p><p><strong>Year-one priorities:</strong></p><ul><li>Launch a shared tool library with 3 anchor farms</li><li>Fund stipends for 6 mentorship pairings</li><li>Publish a land-access resource guide for new growers</li></ul>',
        place: {
          fullText: 'West Oakland, California, United States',
          city: 'Oakland',
          lat: 37.8047,
          lng: -122.2948
        }
      }),
      fundingSubmission('004', p019, FUNDING_SPACE_ID, -86400 * 2, 15, {
        title: 'East Bay Community Forest Stewardship Fund',
        budget: '$7,500',
        commentCount: 2,
        reactionCount: 4,
        details: '<p>Supports the neighborhood land trust securing a hillside parcel in the East Bay hills — the same community forest campaign Community Hub has been crowdfunding on the main stream. This grant covers native plant nursery costs, volunteer stewardship training, and signage for public trail access.</p><p>Funds stay with the land trust and are released as milestones are met: site assessment, planting days, and the first season of community monitoring.</p>',
        place: {
          fullText: 'East Bay hills, Oakland, California, United States',
          city: 'Oakland',
          lat: 37.8200,
          lng: -122.1780
        }
      }),
      fundingSubmission('005', p020, FUNDING_SPACE_ID, -86400 * 1, 12, {
        title: 'Indigenous Cultural Fire & Land Return Coalition',
        budget: '$5,800',
        commentCount: 1,
        reactionCount: 2,
        details: '<p>A coalition of Indigenous land stewards, cultural fire practitioners, and bioregional organizers building capacity for good-fire workshops and land-return advocacy in the Bay Area. Grant funds cover training materials, travel for elders, and coordination with existing prescribed-burn crews.</p><p>This work reconnects cultural fire knowledge with watershed health — reducing catastrophic wildfire risk while restoring oak woodland and grassland ecologies our communities depend on.</p>',
        place: {
          fullText: 'Tilden Regional Park, Berkeley, California, United States',
          city: 'Berkeley',
          lat: 37.8924,
          lng: -122.2416
        }
      })
    ],
    simpleGroupChat: [
      chatPost('simple', '001', me, SIMPLE_GROUP_ID, -3600, 'Morning neighbors — anyone heading to Lake Merritt this afternoon?'),
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
        reactionCount: 2,
        place: {
          fullText: 'Fruitvale, Oakland, California, United States',
          city: 'Oakland',
          lat: 37.7750,
          lng: -122.2244
        }
      }),
      projectPost('simple-102', peopleById[sid('person', 'starter', '001')], SIMPLE_GROUP_ID, -86400 * 36, {
        title: 'Oakland Twilight Markets',
        details: '<p>Let&#39;s get Twilight Markets happening around Lake Merritt — so much of the community is behind it! If you have skills, resources, support, or enthusiasm to put in, connect up here and we will make it happen together.</p>',
        commentCount: 8,
        reactionCount: 4,
        place: {
          fullText: 'Lake Merritt, Oakland, California, United States',
          city: 'Oakland',
          lat: 37.8016,
          lng: -122.2583
        }
      }),
      projectPost('simple-103', peopleById[sid('person', 'starter', '003')], SIMPLE_GROUP_ID, -86400 * 34, {
        title: 'Side by Side',
        details: '<p>Would you like to live in a more connected and supportive neighbourhood? It Takes a Town&#39;s Side by Side project supports us to build closer connections with our neighbours, and helps develop a stronger sense of community.</p><p>Through regular social gatherings, neighbours are encouraged to know each other. Friendships form, people help each other, kids find nearby playmates, and important matters that affect the area can be discussed and shared.</p><p>Side by Side will be delivered in Richmond, El Cerrito, Fruitvale and Downtown Oakland over the coming months — we&#39;d love to hear from anyone living in these areas that would like to get involved.</p>',
        commentCount: 2,
        reactionCount: 1,
        place: {
          fullText: 'El Cerrito, California, United States',
          city: 'El Cerrito',
          lat: 37.9161,
          lng: -122.3108
        }
      }),
      projectPost('simple-104', peopleById[sid('person', 'starter', '003')], SIMPLE_GROUP_ID, -86400 * 33, {
        title: 'Oakland Life',
        details: '<p>Would you like to see the Oakland community more connected, informed and part of a shared local culture? Oakland Life is a working group that came out of the It Takes a Town Reset Workshop with the aim of doing just this. We have recently set up the Oakland Life events calendar and are working on a welcome pack and welcome events for new and old community members.</p><p>Comment below or send a message if you want to get involved.</p>',
        commentCount: 0,
        place: {
          fullText: 'Downtown Oakland, California, United States',
          city: 'Oakland',
          lat: 37.8044,
          lng: -122.2712
        }
      }),
      resourcePost('simple-105', peopleById[sid('person', 'starter', '002')], SIMPLE_GROUP_ID, -86400 * 45, {
        title: 'Studio Space Hire',
        details: '<p>Bright Hearts Imaginarium is a cosy boutique room available to hire Wed, Thu, Fri. Located next to Farley&#39;s on Grand this street front space has disability access, aircon and a small kitchenette. Furnished with a large farm work table, cosy couches and oodles of charm — perfect for a therapist, meetings, arts workshop, discussion groups, photographers. $15/hr, charities by donation.</p><p>Message Finn to enquire.</p>',
        commentCount: 2,
        reactionCount: 2,
        place: {
          fullText: 'Grand Avenue, Oakland, California, United States',
          city: 'Oakland',
          lat: 37.8090,
          lng: -122.2495
        }
      }),
      offerPost('simple-106', peopleById[sid('person', 'starter', '003')], SIMPLE_GROUP_ID, -86400 * 32, {
        title: 'Temescal organic skin care facials',
        details: '<p>Organic facials in Temescal — currently running a heavily discounted promotion at $60 / hr. Message me to book in.</p>',
        commentCount: 4,
        place: {
          fullText: 'Temescal, Oakland, California, United States',
          city: 'Oakland',
          lat: 37.8335,
          lng: -122.2627
        }
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
        reactionCount: 1,
        place: {
          fullText: 'Richmond Recreation Complex, Richmond, California, United States',
          city: 'Richmond',
          lat: 37.9358,
          lng: -122.3477
        }
      }),
      eventPost('simple-112', peopleById[sid('person', 'starter', '001')], SIMPLE_GROUP_ID, -86400 * 4, {
        title: 'North Shattuck produce swap',
        details: '<p>Bring whatever is overflowing — lemons, chard, loquats, sourdough — and leave with something you didn&#39;t grow. Tables go up under the oaks at Live Oak Park. No signup, just a bag.</p><p>If you have nothing to swap, come anyway. Neighbours always bring extra.</p>',
        upcoming: true,
        startTime_local: { days: 3, hour: 10 },
        endTime_local: { days: 3, hour: 12 },
        commentCount: 3,
        reactionCount: 2,
        place: {
          fullText: 'Live Oak Park, North Berkeley, California, United States',
          city: 'Berkeley',
          lat: 37.8836,
          lng: -122.2686
        }
      }),
      eventPost('simple-113', peopleById[sid('person', 'starter', '002')], SIMPLE_GROUP_ID, -86400 * 6, {
        title: 'Tool library open hours',
        details: '<p>The North Berkeley tool shelf is open at the Ohlone Park picnic tables. Borrow a drill, a hedge trimmer, a cargo-bike pump, or a canning pot. Bring it back the following Saturday, or message Finn if you need it longer.</p>',
        upcoming: true,
        startTime_local: { days: 8, hour: 10 },
        endTime_local: { days: 8, hour: 13 },
        commentCount: 1,
        reactionCount: 2,
        place: {
          fullText: 'Ohlone Park, North Berkeley, California, United States',
          city: 'Berkeley',
          lat: 37.8744,
          lng: -122.2828
        }
      }),
      eventPost('simple-114', peopleById[sid('person', 'starter', '003')], SIMPLE_GROUP_ID, -86400 * 2, {
        title: 'Cedar-Rose neighbourhood potluck',
        details: '<p>Side by Side is hosting a potluck on the Cedar-Rose lawn. Bring a dish and a blanket. Kids are welcome — we&#39;ll keep a corner for them if a couple of adults can rotate through.</p>',
        upcoming: true,
        startTime_local: { days: 16, hour: 18 },
        endTime_local: { days: 16, hour: 20 },
        commentCount: 2,
        reactionCount: 3,
        place: {
          fullText: 'Cedar-Rose Park, North Berkeley, California, United States',
          city: 'Berkeley',
          lat: 37.8807,
          lng: -122.2866
        }
      }),
      eventPost('simple-115', p008, SIMPLE_GROUP_ID, -86400 * 12, {
        title: 'Hopkins seed and starts swap',
        details: '<p>We traded tomato starts, bean seed, and a lot of advice outside Monterey Market. The next one will be posted when the winter sowing is ready.</p>',
        upcoming: false,
        startTime_local: { days: -9, hour: 10 },
        endTime_local: { days: -9, hour: 12 },
        commentCount: 1,
        place: {
          fullText: 'Monterey Market, Hopkins Street, Berkeley, California, United States',
          city: 'Berkeley',
          lat: 37.8810,
          lng: -122.2756
        }
      }),
      requestPost('simple-116', me, SIMPLE_GROUP_ID, -86400 * 2, {
        title: 'Borrow a cargo bike for Saturday market',
        details: '<p>I&#39;m hauling citrus and a folding table to the North Shattuck produce swap and my rack won&#39;t hold it. Could I borrow a cargo bike Friday evening through Saturday afternoon? I can pick up around Hopkins.</p>',
        commentCount: 1,
        place: {
          fullText: 'Hopkins Street, North Berkeley, California, United States',
          city: 'Berkeley',
          lat: 37.8812,
          lng: -122.2742
        }
      }),
      requestPost('simple-117', peopleById[sid('person', 'starter', '001')], SIMPLE_GROUP_ID, -86400 * 5, {
        title: 'Ladder to pick the front-yard lemon',
        details: '<p>The Meyer lemon on Ada Street is ready and I can&#39;t reach the top third. Happy to share the fruit with anyone who can lend a ladder for an hour this week.</p>',
        commentCount: 2,
        reactionCount: 1,
        place: {
          fullText: 'Ada Street, North Berkeley, California, United States',
          city: 'Berkeley',
          lat: 37.8784,
          lng: -122.2718
        }
      }),
      requestPost('simple-118', p008, SIMPLE_GROUP_ID, -86400 * 3, {
        title: 'Ride to the rose garden work morning',
        details: '<p>I&#39;m helping mulch the Berkeley Rose Garden on Sunday and don&#39;t have a car for the tools. If you&#39;re heading up Euclid, I can meet you at North Berkeley BART.</p>',
        place: {
          fullText: 'Berkeley Rose Garden, Euclid Avenue, Berkeley, California, United States',
          city: 'Berkeley',
          lat: 37.8857,
          lng: -122.2614
        }
      }),
      requestPost('simple-119', peopleById[sid('person', 'starter', '003')], SIMPLE_GROUP_ID, -86400, {
        title: 'An extra adult for the potluck kids corner',
        details: '<p>The Cedar-Rose potluck needs one more adult to rotate through the kids corner for an hour. You can eat with us the rest of the time. Message me if you can take a shift.</p>',
        commentCount: 1,
        place: {
          fullText: 'Cedar-Rose Park, North Berkeley, California, United States',
          city: 'Berkeley',
          lat: 37.8804,
          lng: -122.2859
        }
      }),
      offerPost('simple-120', peopleById[sid('person', 'starter', '001')], SIMPLE_GROUP_ID, -86400, {
        title: 'Meyer lemons and extra chard',
        details: '<p>The backyard is overloaded. A bag of Meyer lemons and a bunch of rainbow chard are on the porch on Virginia Street — take what you need and leave the bag. I&#39;ll restock after the weekend harvest.</p>',
        commentCount: 2,
        reactionCount: 3,
        place: {
          fullText: 'Virginia Street, North Berkeley, California, United States',
          city: 'Berkeley',
          lat: 37.8758,
          lng: -122.2774
        }
      }),
      offerPost('simple-121', p008, SIMPLE_GROUP_ID, -86400 * 4, {
        title: 'Tomato and basil starts',
        details: '<p>I sowed too many. Six tomato starts and a tray of basil are on the steps by Indian Rock, free to anyone who will actually plant them. Bring a tray, or I have yogurt tubs.</p>',
        commentCount: 1,
        reactionCount: 2,
        place: {
          fullText: 'Indian Rock Park, North Berkeley, California, United States',
          city: 'Berkeley',
          lat: 37.8924,
          lng: -122.2725
        }
      }),
      offerPost('simple-122', peopleById[sid('person', 'starter', '002')], SIMPLE_GROUP_ID, -86400 * 3, {
        title: 'Folding tables and a projector',
        details: '<p>Two 6-foot folding tables and a small projector live with the tool library. Borrow them for a block party or a skill-share. Message Finn to pick up near King Park.</p>',
        commentCount: 1,
        reactionCount: 1,
        place: {
          fullText: 'King Park, Hopkins Street, Berkeley, California, United States',
          city: 'Berkeley',
          lat: 37.8820,
          lng: -122.2792
        }
      }),
      offerPost('simple-123', peopleById[sid('person', 'starter', '003')], SIMPLE_GROUP_ID, -86400 * 2, {
        title: 'Saturday sourdough, two loaves spare',
        details: '<p>I bake two extra country loaves every Saturday morning. First message gets them — pickup on Solano before noon, or I can bring them to the produce swap.</p>',
        commentCount: 3,
        reactionCount: 2,
        place: {
          fullText: 'Solano Avenue, Berkeley, California, United States',
          city: 'Berkeley',
          lat: 37.8910,
          lng: -122.2868
        }
      })
    ],
    staffGroupChat: [
      chatPost('staff', '001', me, STAFF_GROUP_ID, -7200, 'Morning team — who is facilitating the Fruitvale skill-share on Thursday?'),
      chatPost('staff', '002', p003, STAFF_GROUP_ID, -7000, 'I can take it. Maya, can you bring the leftover zines from last month?'),
      chatPost('staff', '003', p003, STAFF_GROUP_ID, -6800, 'I&#39;ll take notes and drop surplus numbers in the shared folder after.'),
      chatPost('staff', '004', p004, STAFF_GROUP_ID, -6600, 'Studio key is with Ezra today. Text if you need the cupboard unlocked.'),
      chatPost('staff', '005', p005, STAFF_GROUP_ID, -6400, 'Reminder: worker-owner huddle Monday 10am. Agenda is season fund + who is on call for gigs.'),
      chatPost('staff', '006', me, STAFF_GROUP_ID, -6200, 'Love it. Drop asks in the stream too — bookkeeping help, workshop hosts, all welcome.')
    ],
    staffGroupStream: [
      discussionPost('staff-201', me, STAFF_GROUP_ID, -86400 * 50, {
        title: 'We are now worker-owned',
        details: '<p>Today is a huge day — we are formally organizing as a worker-owned cooperative.</p><p>We will use this space to coordinate our shared work: neighborhood gatherings, skill-shares, and facilitation for groups who want help working together in person. We will never sell anyone&#39;s data, we will never sell out, and we work in deep partnership with people building a world that works for all.</p><p>If you want to help host, keep the books, or take on a neighborhood gig, get in touch. We will hold a design jam soon to decide how we share surplus and how we take on work together.</p>',
        announcement: true,
        commentCount: 1,
        reactionCount: 3,
        place: {
          fullText: 'Temescal, Oakland, California, United States',
          city: 'Oakland',
          lat: 37.8370,
          lng: -122.2623
        }
      }),
      requestPost('staff-202', me, STAFF_GROUP_ID, -86400 * 42, {
        title: 'Season fund ready to go',
        details: '<p>We finally got a campaign up to cover shared costs for the studio and sliding-scale workshops. We&#39;d love some feedback before we send it more widely.</p><p>We are raising community contributions through our fiscal sponsor with the hope of at least covering studio rent, currently around $900/month. If you feel called to give, we would be forever grateful.</p>',
        commentCount: 3,
        reactionCount: 3,
        place: {
          fullText: 'Temescal, Oakland, California, United States',
          city: 'Oakland',
          lat: 37.8370,
          lng: -122.2623
        }
      }),
      discussionPost('staff-203', p004, STAFF_GROUP_ID, -86400 * 40, {
        title: 'Thank you',
        details: '<p>Just want to share that I love that you all are bringing this cooperative back to life.</p><p>I was around as a design advisor when we were figuring out how we make decisions together. It&#39;s something I&#39;ve kept my eye on for a while.</p><p>Would be happy to give any feedback on how we host and how we share the work going forward.</p>',
        commentCount: 0,
        reactionCount: 2
      }),
      eventPost('staff-204', me, STAFF_GROUP_ID, -86400 * 36, {
        title: 'Co-op season launch gathering',
        details: '<p>Dear friends,</p><p>It is with great excitement that we are announcing the launch of our season fund! We are looking to raise community support so we can keep hosting sliding-scale workshops and neighborhood gatherings this year.</p><p>To celebrate we are hosting a virtual launch gathering. We will walk through the season plan and bring in partners who are hosting with us.</p><p>Feel free to join when you can. Link will be posted on the day!</p>',
        location: 'Online',
        upcoming: false,
        commentCount: 4,
        reactionCount: 2
      }),
      requestPost('staff-205', me, STAFF_GROUP_ID, -86400 * 34, {
        title: 'Launching our season fund',
        details: '<p>Today&#39;s the big day — we&#39;re launching our season fund for the co-op.</p><p>We are looking to raise $100k from our wider community so we can pay facilitation stipends, cover studio rent, and keep workshops sliding-scale. A small cooperative only works if the village around it is in.</p><p>This is not just about money. It is even more important to build relationships with anyone who shares this way of working. If you want to facilitate, keep books, or connect us with a neighborhood that needs a gathering, please get in touch.</p><p>Thank you for your support. We are just at the beginning of this season together.</p><p>In solidarity,<br/>Maya, Kai, Elena<br/>Worker Co-op Staff</p>',
        commentCount: 6,
        reactionCount: 4
      }),
      eventPost('staff-206', me, STAFF_GROUP_ID, -86400 * 28, {
        title: 'Season wrap and member celebration',
        details: '<p>Join us to celebrate the season fund and everyone who signed up as a supporting member. As we keep offering our co-op&#39;s gatherings as a gift to neighborhoods that want to work together, it means the world that so many of you want to come along.</p><p>Here&#39;s what we&#39;re planning:</p><p>- Campaign wrap with numbers, lessons, and plans for the next season</p><p>- Maya will walk through how we&#39;re hosting gatherings this season</p><p>- Meet the worker-owners</p><p>- Get involved: we are inviting supporting members into facilitation, bookkeeping, and outreach</p>',
        location: 'Online',
        upcoming: false,
        commentCount: 3,
        reactionCount: 2
      }),
      resourcePost('staff-207', me, STAFF_GROUP_ID, -86400 * 20, {
        title: '10 minute co-op walkthrough to share',
        details: '<p>I made a video that goes through how we work at the co-op for new worker-owners (it doesn&#39;t cover every internal process).</p><p>Feel free to share around!</p><p>We will make one for hosting partners soon, and a shorter one that leaves out the joining process.</p>',
        commentCount: 3,
        reactionCount: 2,
        place: {
          fullText: 'Fruitvale, Oakland, California, United States',
          city: 'Oakland',
          lat: 37.7758,
          lng: -122.2241
        }
      })
    ],
    byId: null // filled below
  }
}

function basePost (id, creator, groupId, createdAtOffset, type, extras = {}) {
  return {
    id: sid('post', id),
    title: extras.title || PLACEHOLDER_NAME,
    details: extras.details || htmlCopy(),
    type,
    createdAt_offset: createdAtOffset,
    updatedAt_offset: createdAtOffset + 3600,
    creator,
    groups: [{ id: groupId, name: groupDisplayName(groupId) }],
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

function groupDisplayName (groupId) {
  if (groupId === MAIN_GROUP_ID) return 'Community Hub'
  if (groupId === STAFF_GROUP_ID) return 'Worker Co-op Staff'
  if (groupId === FUNDING_SPACE_ID) return 'Bioregional Grants Round 1'
  if (groupId === CHAT_SPACE_ID) return 'Introductions'
  return 'Local Sharing Network'
}

function locationFields (num, extras = {}) {
  const { place, withLocation, location } = extras
  if (!place && !withLocation) return {}
  const loc = place || {
    fullText: 'Oakland, California, United States',
    city: 'Oakland',
    lat: 37.8044,
    lng: -122.2712
  }
  return {
    location: location || loc.fullText,
    locationObject: bayLocation(sid('location', 'post', num), loc)
  }
}

function withoutPlace (extras = {}) {
  const { place, withLocation, ...rest } = extras
  return rest
}

function discussionPost (num, creator, groupId, createdAtOffset, extras = {}) {
  return basePost(num, creator, groupId, createdAtOffset, 'discussion', {
    ...withoutPlace(extras),
    fields: locationFields(num, extras)
  })
}

function eventPost (num, creator, groupId, createdAtOffset, extras = {}) {
  const {
    upcoming,
    location,
    place,
    startTime_offset: startOffset,
    endTime_offset: endOffset,
    startTime_local: startLocal,
    endTime_local: endLocal,
    ...rest
  } = extras
  const start = startOffset != null ? startOffset : (upcoming ? 86400 * 5 : -86400 * 3)
  const end = endOffset != null ? endOffset : start + 7200
  const times = startLocal
    ? {
        startTime_local: startLocal,
        endTime_local: endLocal || { ...startLocal, hour: (startLocal.hour || 10) + 2 }
      }
    : { startTime_offset: start, endTime_offset: end }
  return basePost(num, creator, groupId, createdAtOffset, 'event', {
    ...rest,
    fields: {
      ...times,
      timezone: 'America/Los_Angeles',
      location: location || place?.fullText || null,
      meetingLink: null,
      myEventResponse: upcoming ? 'yes' : null,
      ...locationFields(num, { place, location })
    }
  })
}

function proposalPost (num, creator, groupId, createdAtOffset, { voting, discussionPhase, title, details } = {}) {
  return basePost(num, creator, groupId, createdAtOffset, 'proposal', {
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

function requestPost (num, creator, groupId, createdAtOffset, extras = {}) {
  return basePost(num, creator, groupId, createdAtOffset, 'request', {
    ...withoutPlace(extras),
    fields: { endTime_offset: 86400 * 14, ...locationFields(num, extras) }
  })
}

function offerPost (num, creator, groupId, createdAtOffset, extras = {}) {
  return basePost(num, creator, groupId, createdAtOffset, 'offer', {
    ...withoutPlace(extras),
    fields: { endTime_offset: 86400 * 30, ...locationFields(num, extras) }
  })
}

function projectPost (num, creator, groupId, createdAtOffset, extras = {}) {
  return basePost(num, creator, groupId, createdAtOffset, 'project', {
    ...withoutPlace(extras),
    fields: locationFields(num, extras)
  })
}

function resourcePost (num, creator, groupId, createdAtOffset, extras = {}) {
  return basePost(num, creator, groupId, createdAtOffset, 'resource', {
    ...withoutPlace(extras),
    fields: locationFields(num, extras)
  })
}

function chatPost (prefix, num, creator, groupId, createdAtOffset, text) {
  return basePost(`${prefix}-${num}`, creator, groupId, createdAtOffset, 'chat', {
    title: null,
    details: '<p>' + (text || PLACEHOLDER_COPY.slice(0, 140)) + '</p>'
  })
}

function fundingSubmission (num, creator, groupId, createdAtOffset, tokensAllocated, extras = {}) {
  return basePost(`fr-${num}`, creator, groupId, createdAtOffset, 'project', {
    title: extras.title,
    details: extras.details,
    commentCount: extras.commentCount || 0,
    reactionCount: extras.reactionCount || 0,
    fields: {
      budget: extras.budget || '$5,000',
      fundingRound: { id: FUNDING_ROUND_ID, group: { name: 'Bioregional Grants Round 1' } },
      tokensAllocated,
      totalTokensAllocated: tokensAllocated + 8,
      ...locationFields(`fr-${num}`, extras)
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
