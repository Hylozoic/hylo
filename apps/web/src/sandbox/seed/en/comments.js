import { htmlCopy, sid } from '../helpers'
import { ME_ID } from './people'

/**
 * Comments keyed by post id, drawn from real Terran Collective conversations.
 */
export function buildCommentsByPostId (peopleById, meId) {
  const me = peopleById[meId]
  const p002 = peopleById[sid('person', '002')]
  const p003 = peopleById[sid('person', '003')]
  const p004 = peopleById[sid('person', '004')]
  const p005 = peopleById[sid('person', '005')]
  const p006 = peopleById[sid('person', '006')]
  const p007 = peopleById[sid('person', '007')]
  const p008 = peopleById[sid('person', '008')]
  const p009 = peopleById[sid('person', '009')]
  const p010 = peopleById[sid('person', '010')]
  const p012 = peopleById[sid('person', '012')]
  const p018 = peopleById[sid('person', '018')]
  const p019 = peopleById[sid('person', '019')]
  const p020 = peopleById[sid('person', '020')]
  const cleo = peopleById[sid('person', 'starter', '001')]
  const finn = peopleById[sid('person', 'starter', '002')]
  const anjali = peopleById[sid('person', 'starter', '003')]

  return {
    // Crowdfunding the East Bay Community Forest
    [sid('post', '001')]: [
      comment('001-c01', me, -86400 * 13 + 1000,
        '<p>The zoom link is live! https://us02web.zoom.us/j/85244276165 — Meeting ID: 852 4427 6165 · Passcode: 986186</p>'),
      comment('001-c02', p002, -86400 * 13 + 2000,
        '<p>Great event!</p>'),
      comment('001-c03', p003, -86400 * 13 + 5000,
        '<p>Such a heartwarming event...</p>'),
      comment('001-c04', p004, -86400 * 13 + 7000,
        '<p>Where are the videos of these meetings located? I missed the end! Such a great presentation by all!</p>'),
      comment('001-c05', me, -86400 * 13 + 8000,
        '<p>Here&#39;s the recorded video! We walked through the site map, the planting plan, and how the land trust will hold the parcel.</p>'),
      comment('001-c06', p005, -86400 * 13 + 9000,
        '<p>We&#39;re in, through our Cohousing California organizing — looking at this forest as a gathering place and a living classroom for the network.</p>'),
      comment('001-c07', p006, -86400 * 13 + 10000,
        '<p>I&#39;d love to donate but sending USD will get me a big charge. Any way to donate outside of the US?</p>'),
      comment('001-c08', me, -86400 * 13 + 11000,
        '<p>Does PayPal work better? You could also donate here: http://paypal.me/terrancollective</p>'),
      comment('001-c09', p006, -86400 * 13 + 12000,
        '<p>Yep, PayPal is perfect — sorted! 🙏</p>'),
      comment('001-c10', me, -86400 * 13 + 13000,
        '<p>Thank you so much! 💚</p>'),
      comment('001-c11', p007, -86400 * 13 + 14000,
        '<p>Let&#39;s definitely chat — community-held land is exactly the kind of stewardship this bioregion needs.</p>'),
      comment('001-c12', p008, -86400 * 13 + 15000,
        '<p>This is a critical moment. I&#39;ve been following this hillside for years and I&#39;m so glad to see it coming into community care.</p>')
    ],

    // What would you spend $5 million on?
    [sid('post', '002')]: [
      comment('002-c01', p009, -86400 * 9 + 1000,
        '<p>I would give to Regenerative Agriculture organizations doing soil carbon sequestration work at scale — something like the Rodale Institute, White Oak Pastures, or Kiss the Ground.</p>'),
      comment('002-c02', p010, -86400 * 9 + 2000,
        '<p>Rights of Nature legal campaigns, specifically groups like the Community Environmental Legal Defense Fund and the Global Alliance for the Rights of Nature. The legal infrastructure for nature to have standing is foundational.</p>'),
      comment('002-c03', me, -86400 * 9 + 3000, {
        text: '<p>Love this thread. I would put a significant chunk into BIPOC-led land reclamation and urban farming, and also into cooperative housing and land trust models.</p>',
        childComments: [
          comment('002-c03-r01', p005, -86400 * 9 + 4000,
            '<p>Yes! EB PREC in Oakland is doing incredible work on this. Highly recommend.</p>')
        ]
      }),
      comment('002-c04', p012, -86400 * 9 + 5000,
        '<p>Distributed open-source infrastructure for communities — platforms like Hylo, Decidim, Open Collective, and others that help communities self-organize without depending on exploitative tech giants.</p>'),
      comment('002-c05', p019, -86400 * 9 + 6000,
        '<p>Indigenous land rematriation. Returning land to Indigenous stewards is one of the highest-leverage things we can do for ecological health and for justice.</p>')
    ],

    // Bay Area Regen CoLab - Permaculture (POST 003)
    [sid('post', '003')]: [
      comment('003-c01', p008, -86400 * 7 + 1000,
        '<p>Is there an easy way to export a Hylo event to Google Calendar?</p>'),
      comment('003-c02', p008, -86400 * 7 + 1500,
        '<p>Also — the event date did not show in the email notification!</p>'),
      comment('003-c03', me, -86400 * 7 + 3000,
        '<p>Here&#39;s the notes! https://docs.google.com/document/d/1R0yHlodMkmdSIpff1y4mTQyZOFB7aeT69RWWk2t0rEQ/edit</p>'),
      comment('003-c04', me, -86400 * 7 + 3100,
        '<p>And the video recording! https://www.youtube.com/watch?v=fhsJBU9LecE</p>'),
      comment('003-c05', me, -86400 * 7 + 3200,
        '<p>Thanks for flagging the email issue — will fix that!</p>'),
      comment('003-c06', me, -86400 * 7 + 3300,
        '<p>Not yet for calendar export... planning this feature for the fall!</p>')
    ],

    // Rights of Nature (POST 006)
    [sid('post', '006')]: [
      comment('006-c01', p009, -86400 * 5 + 1000,
        '<p>I am a big fan of Rights of Nature activism. Even for me the "Bay Delta" is a big ask — what a wonderful, big idea.</p>'),
      comment('006-c02', p010, -86400 * 5 + 2000,
        '<p>Elena, it&#39;s an awesome idea. We&#39;re happy to help with webinars and trainings — the Bioneers community would be very interested. Email me at tal@pa.net.</p>'),
      comment('006-c03', p012, -86400 * 5 + 3000,
        '<p>Hi Elena, I&#39;m based in the SF Bay Area and would be interested in joining your group.</p>'),
      comment('006-c04', p009, -86400 * 5 + 4000,
        '<p>Pachamama Alliance also has a rights of nature program with successes in Ecuador and Florida. We have lots of resources!</p>'),
      comment('006-c05', me, -86400 * 5 + 5000,
        '<p>Check this out! 🙌</p>'),
      comment('006-c06', p019, -86400 * 5 + 6000,
        '<p>Yes!! Rights of nature!!</p>'),
      comment('006-c07', p003, -86400 * 5 + 7000, {
        text: '<p>I&#39;m producing a virtual film festival for the Global Freshwater Summit — the themes are rivers and rights of nature. Great place to connect. Opening registration next week, event April 19-23.</p>',
        childComments: [
          comment('006-c07-r01', me, -86400 * 5 + 8000,
            '<p>This is fantastic. Thanks Wayne!</p>')
        ]
      }),
      comment('006-c08', p010, -86400 * 5 + 9000,
        '<p>Just saw this post! One of my projects is https://filmsfortheplanet.com/ — the summit is a great opportunity to connect and continue the conversation.</p>')
    ],

    // Join the Hylo stewardship team (POST 007)
    [sid('post', '007')]: [
      comment('007-c01', p004, -86400 * 4 + 1000,
        '<p>Yes, I am interested in the Stakeholder Advocate position. Trying to fill the form but it is asking for permissions — would you clarify? Thanks in advance.</p>'),
      comment('007-c02', me, -86400 * 4 + 2000,
        '<p>Try again — the form should be open now!</p>'),
      comment('007-c03', p004, -86400 * 4 + 3000,
        '<p>Thank you, it is open now. I will take the time to properly submit my application shortly.</p>')
    ],

    // Maximum wage ratio (POST 008)
    [sid('post', '008')]: [
      comment('008-c01', p006, -86400 * 3 + 1000,
        '<p>Unfortunately the unscrupulous high-end earners will always find ways to mask their income. I think it would be more helpful if we stopped entitling them to cheap labor through &quot;Economic Development&quot; schemes.</p>'),
      comment('008-c02', p020, -86400 * 3 + 2000,
        '<p>I like this example at Friends House London — I believe it used to be 8-1, now it&#39;s 4-1. https://www.friendshouse.co.uk/news/we-are-a-living-wage-employer/</p>'),
      comment('008-c03', me, -86400 * 3 + 3000, {
        text: '<p>I agree, most wealth is not generated from income and this is only one small lever. We also need to tax the rich a lot more, close loopholes, and most of all change culture so accumulation of wealth is no longer what is cool or respected.</p>',
        childComments: [
          comment('008-c03-r01', p020, -86400 * 3 + 3500,
            '<p>Yes — when accumulation is no longer seen as the goal, a more balanced and equitable money flow that nurtures all systems can be present.</p>')
        ]
      }),
      comment('008-c04', p007, -86400 * 3 + 4000,
        '<p>I think 10:1 max within any organisation — more appropriately 5x the lowest salary. Allow multiple income sources across non-affiliated businesses. And increase tax on corporations.</p>'),
      comment('008-c05', p019, -86400 * 3 + 6000,
        '<p>There are great examples from the Mondragon cooperative in Spain — they&#39;ve maintained roughly a 6:1 ratio for decades. Worth looking at as a model.</p>'),
      comment('008-c06', p012, -86400 * 3 + 7000,
        '<p>Buckminster Fuller talked about this kind of systemic redesign — shifting incentive structures so the system itself no longer rewards extractive behavior. You can&#39;t patch your way to a new paradigm.</p>')
    ],

    // Afforestation (POST 011)
    [sid('post', '011')]: [
      comment('011-c01', p012, -86400 + 1000,
        '<p>YES! I&#39;ve been wanting to start a Miyawaki forest project in the East Bay for years. Let&#39;s connect!</p>')
    ],

    // Front Fence Free Food Share
    [sid('post', 'simple-101')]: [
      comment('101-c01', me, -86400 * 39,
        '<p>FFFFS is most active on the Front Fence Free Food Share facebook group if you&#39;d like to join in. Happy Food Sharing!</p>')
    ],

    // Oakland Twilight Markets
    [sid('post', 'simple-102')]: [
      comment('102-c01', finn, -86400 * 35,
        '<p>I would be interested in having a market stall. I make macrame items in the local area.</p>'),
      comment('102-c02', me, -86400 * 34 + 2000,
        '<p>Who instigated the concept of the Oakland Twilight Markets? I&#39;m looking to identify who might be passionate enough to consider participating in Pitch for Change — we&#39;d like to provide some support to bring this idea to life.</p>'),
      comment('102-c03', cleo, -86400 * 33,
        '<p>Could everyone post up how they see themselves being involved with the Twilight Markets? i.e helping to organise them, having a market stall, etc. Like Finn has done already, thank you Finn!</p>'),
      comment('102-c04', cleo, -86400 * 33 + 200,
        '<p>I see myself supporting the Twilight Markets project through East Bay Connect. I&#39;m happy to reach out to more people to find other organising team members too.</p>'),
      comment('102-c05', finn, -86400 * 33 + 400,
        '<p>I have years of experience in the event industry. If you need any help to get this off the ground I&#39;m happy to come along to any meetings and share ideas. I also currently travel to many twilight markets in the region.</p>'),
      comment('102-c06', me, -86400 * 32,
        '<p>If anyone is feeling passionate enough about kicking off Twilight Markets at Lake Merritt, It Takes a Town would love to help you plan and launch the initiative through Pitch for Change. If interested, let me know.</p>'),
      comment('102-c07', anjali, -86400 * 31,
        '<p>I would love to get on board with live music. Please let me know how I can get involved! Love to see Oakland expanding! :)</p>'),
      comment('102-c08', anjali, -86400 * 30,
        '<p>This is an awesome initiative — as a person who likes markets but hates the heat, and a die hard night owl, I am so attracted to this concept and would happily join an organising role as a volunteer.</p>')
    ],

    // Side by Side
    [sid('post', 'simple-103')]: [
      comment('103-c01', cleo, -86400 * 33 + 1000,
        '<p>Hi, this funding may be of interest</p>'),
      comment('103-c02', cleo, -86400 * 33 + 1100,
        '<p>https://www.grants.ca.gov</p>')
    ],

    // Studio Space Hire
    [sid('post', 'simple-105')]: [
      comment('105-c01', cleo, -86400 * 44,
        '<p>It&#39;s a beautiful space, feels very peaceful &amp; creative. Thanks for sharing Finn :)</p>'),
      comment('105-c02', anjali, -86400 * 43,
        '<p>Looking forward to hosting something in there soon. Beautiful, calm space you&#39;ve created there.</p>')
    ],

    // Organic facials
    [sid('post', 'simple-106')]: [
      comment('106-c01', cleo, -86400 * 31,
        '<p>Hello Anjali, welcome to East Bay Connect :) This sounds pretty luxurious, how much are your treatments?</p>'),
      comment('106-c02', anjali, -86400 * 31 + 400,
        '<p>I&#39;m doing a heavily discounted promotion this month — $60 /hr session.</p>'),
      comment('106-c03', me, -86400 * 30,
        '<p>Hi Anjali, how do you book in for a facial? Sounds fabulous.</p>'),
      comment('106-c04', anjali, -86400 * 30 + 800,
        '<p>Hi Elena. Thanks for connecting. Send me a message through Hylo and we&#39;ll find a time. Warm regards, Anjali.</p>')
    ],

    // Skill to share
    [sid('post', 'simple-107')]: [
      comment('107-c01', anjali, -86400 * 27,
        '<p>I wonder if you&#39;d like to partner for a skill share? Our foundation course is either run over 2 consecutive days or as a 6-week course. I&#39;d be keen to talk about something later in the year.</p>'),
      comment('107-c02', me, -86400 * 26,
        '<p>That&#39;s a great offer, but our needs for Skillshare are one-off sessions. Our group of participants aren&#39;t ready for a 6 week course. In saying that, we can certainly help you find participants for your course if you&#39;re interested.</p>'),
      comment('107-c03', anjali, -86400 * 26 + 500,
        '<p>Ah, thanks Elena. I&#39;m good for participants at this stage, it&#39;s covering costs I&#39;m still working on.</p>'),
      comment('107-c04', finn, -86400 * 24,
        '<p>Hi Elena. I&#39;m aware you posted this a few weeks ago but it occurs to me I could offer a relationship mindfulness workshop. Is it too late to be organised?</p>'),
      comment('107-c05', me, -86400 * 23,
        '<p>Thanks so much for the offer. We already have one mindfulness workshop in the next series. We&#39;ll be asking for workshop offers again next term, so please watch out if you have time.</p>'),
      comment('107-c06', finn, -86400 * 23 + 800,
        '<p>That&#39;s wonderful! Two questions: 1. I can also offer workshops on empowerment and Aware Parenting. Would any of those be useful? 2. Where can I find the program for the series?</p>')
    ],

    // Connect with an older person
    [sid('post', 'simple-108')]: [
      comment('108-c01', finn, -86400 * 21,
        '<p>What a great initiative. I already connect with a couple of older people in my local area and help out where I can and it is so rewarding.</p>')
    ],

    // Projector and screen
    [sid('post', 'simple-110')]: [
      comment('110-c01', anjali, -86400 * 18,
        '<p>I know someone who has a projector. I don&#39;t know about the screen, though.</p>')
    ],

    // Richmond resilience
    [sid('post', 'simple-111')]: [
      comment('111-c01', anjali, -86400 * 30,
        '<p>Doing a good job. &lt;3</p>')
    ],

    [sid('post', 'staff-201')]: [
      comment('s201-c01', p004, -86400 * 49,
        '<p>Thanks Elena, Maya. This is a great write up. I&#39;m particularly excited by how we&#39;ll share surplus and take on gigs together.</p>')
    ],

    [sid('post', 'staff-202')]: [
      comment('s202-c01', p005, -86400 * 41,
        '<p>Hi! I&#39;m planning to post next week about using Holistica for neighborhood gatherings. Anything else I should particularly mention? Have you found someone for the books yet?</p>'),
      comment('s202-c02', me, -86400 * 41 + 500,
        '<p>that sounds great, thanks! no, sadly we have not... still working on it. really should only take a day or two to settle once we find someone.</p>'),
      comment('s202-c03', p003, -86400 * 40,
        '<p>Beyond giving, I would be happy to contribute time. What might be the best way for me to help with hosting?</p>')
    ],

    [sid('post', 'staff-204')]: [
      comment('s204-c01', p010, -86400 * 35,
        '<p>Can&#39;t make this but would love to see the recording.</p>'),
      comment('s204-c02', me, -86400 * 35 + 400,
        '<p>it will be recorded on Zoom — I&#39;ll drop the link here after.</p>'),
      comment('s204-c03', p002, -86400 * 34,
        '<p>Following for the recording link when available.</p>'),
      comment('s204-c04', me, -86400 * 33,
        '<p>Video is up in the shared folder. Thank you everyone who came.</p>')
    ],

    [sid('post', 'staff-205')]: [
      comment('s205-c01', me, -86400 * 33 + 1000,
        '<p>The zoom info is in chat — join when you can.</p>'),
      comment('s205-c02', p010, -86400 * 33 + 2000,
        '<p>Great gathering!</p>'),
      comment('s205-c03', p003, -86400 * 32,
        '<p>Such a heartwarming evening.</p>'),
      comment('s205-c04', p006, -86400 * 31,
        '<p>hey I would give but sending USD will get me a big charge — any way to contribute outside the US?</p>'),
      comment('s205-c05', me, -86400 * 31 + 500,
        '<p>Does PayPal work better? you could also give here: http://paypal.me/holistica</p>'),
      comment('s205-c06', p006, -86400 * 30,
        '<p>yep PayPal is perfect, sorted!</p>')
    ],

    [sid('post', 'staff-206')]: [
      comment('s206-c01', p007, -86400 * 27,
        '<p>Will you be providing a recording of the gathering? Its a bit late on a weekday for me (Europe)</p>'),
      comment('s206-c02', me, -86400 * 26,
        '<p>yes definitely!</p>'),
      comment('s206-c03', me, -86400 * 24,
        '<p>We had some zoom bombers in the middle that we want to edit out before posting. Soon!</p>')
    ],

    [sid('post', 'staff-207')]: [
      comment('s207-c01', p002, -86400 * 19,
        '<p>Hooray thank you!!!!</p>'),
      comment('s207-c02', p002, -86400 * 18,
        '<p>Hi Elena, is it possible for me to download the video?</p>'),
      comment('s207-c03', me, -86400 * 18 + 400,
        '<p>You should be able to by clicking on the 3 dots next to Copy Link. I can also drop it in the shared folder.</p>')
    ],

    [sid('post', 'fr-001')]: [
      comment('fr001-c01', p002, -86400 * 4 + 1000,
        '<p>Love the community science angle — we have two gardens in Oakland that would love to be sampling sites.</p>'),
      comment('fr001-c02', p007, -86400 * 4 + 2000,
        '<p>Would the open data integrate with existing watershed monitoring projects?</p>'),
      comment('fr001-c03', peopleById[sid('person', '016')], -86400 * 4 + 3000,
        '<p>Yes! We&#39;re designing the schema to export to common GIS formats. Happy to connect offline about your sites.</p>')
    ],

    [sid('post', 'fr-002')]: [
      comment('fr002-c01', p004, -86400 * 3 + 1000,
        '<p>This is exactly what our cooperative farm network needs — practical, place-based learning without the debt trap.</p>'),
      comment('fr002-c02', me, -86400 * 3 + 2000,
        '<p>Strong submission. The CC licensing makes this easy to share with partner groups outside Terran too.</p>')
    ],

    [sid('post', 'fr-003')]: [
      comment('fr003-c01', p003, -86400 * 2 + 1000,
        '<p>The tool library idea is brilliant. Richmond has several farms that could anchor this.</p>'),
      comment('fr003-c02', p008, -86400 * 2 + 1500,
        '<p>Would mentorship stipends prioritize growers who are just getting land access?</p>'),
      comment('fr003-c03', p018, -86400 * 2 + 2500,
        '<p>Yes — that&#39;s the core of the design. We&#39;re pairing experienced operators with folks on year-one leases.</p>'),
      comment('fr003-c04', p012, -86400 * 2 + 3500,
        '<p>Putting a big chunk of my tokens here. This network could outlast any single grant cycle.</p>')
    ],

    [sid('post', 'fr-004')]: [
      comment('fr004-c01', me, -86400 * 1 + 1000,
        '<p>Great to see the forest campaign show up here too — ties the stream conversation to real allocation.</p>'),
      comment('fr004-c02', p006, -86400 * 1 + 2000,
        '<p>The milestone-based release gives me confidence the funds stay accountable to the land trust.</p>')
    ],

    [sid('post', 'fr-005')]: [
      comment('fr005-c01', p009, -86400 + 1000,
        '<p>Important work. Cultural fire practitioners have been under-resourced for too long in this bioregion.</p>')
    ]
  }
}

function comment (num, creator, createdAt_offset, extrasOrText = {}) {
  const isString = typeof extrasOrText === 'string'
  const text = isString ? extrasOrText : (extrasOrText.text || htmlCopy())
  const childComments = (!isString && extrasOrText.childComments) || []
  return {
    id: sid('comment', num),
    text,
    createdAt_offset,
    creator,
    parentComment: null,
    attachments: [],
    childComments,
    commentReactions: [],
    commentsTotal: childComments.length
  }
}

/**
 * Reactions keyed by post id — drawn from real DB reactions.
 */
export function buildReactionsByPostId (peopleById, meId) {
  const pick = id => peopleById[id]
  return {
    [sid('post', '001')]: [
      reaction('001-r01', pick(meId), '👍', -86400 * 13),
      reaction('001-r02', pick(sid('person', '003')), '❤️', -86400 * 13 + 500),
      reaction('001-r03', pick(sid('person', '004')), '🎉', -86400 * 13 + 1000),
      reaction('001-r04', pick(sid('person', '005')), '👍', -86400 * 13 + 1500),
      reaction('001-r05', pick(sid('person', '006')), '👍', -86400 * 13 + 2000),
      reaction('001-r06', pick(sid('person', '007')), '👍', -86400 * 13 + 2500),
      reaction('001-r07', pick(sid('person', '008')), '👍', -86400 * 13 + 3000),
      reaction('001-r08', pick(sid('person', '009')), '👍', -86400 * 13 + 3500),
      reaction('001-r09', pick(sid('person', '010')), '💚', -86400 * 13 + 4000),
      reaction('001-r10', pick(sid('person', '012')), '👍', -86400 * 13 + 4500)
    ],
    [sid('post', '002')]: [
      reaction('002-r01', pick(sid('person', '002')), '👍', -86400 * 9),
      reaction('002-r02', pick(sid('person', '006')), '👍', -86400 * 9 + 500),
      reaction('002-r03', pick(sid('person', '007')), '💡', -86400 * 9 + 1000),
      reaction('002-r04', pick(sid('person', '008')), '👍', -86400 * 9 + 1500),
      reaction('002-r05', pick(sid('person', '019')), '👍', -86400 * 9 + 2000),
      reaction('002-r06', pick(sid('person', '020')), '👍', -86400 * 9 + 2500),
      reaction('002-r07', pick(meId), '🎉', -86400 * 9 + 3000),
      reaction('002-r08', pick(sid('person', '003')), '👍', -86400 * 9 + 3500)
    ],
    [sid('post', '006')]: [
      reaction('006-r01', pick(meId), '👍', -86400 * 5),
      reaction('006-r02', pick(sid('person', '009')), '👍', -86400 * 5 + 500),
      reaction('006-r03', pick(sid('person', '010')), '👍', -86400 * 5 + 1000),
      reaction('006-r04', pick(sid('person', '012')), '🌊', -86400 * 5 + 1500),
      reaction('006-r05', pick(sid('person', '019')), '👍', -86400 * 5 + 2000),
      reaction('006-r06', pick(sid('person', '020')), '👍', -86400 * 5 + 2500),
      reaction('006-r07', pick(sid('person', '003')), '👍', -86400 * 5 + 3000),
      reaction('006-r08', pick(sid('person', '004')), '👍', -86400 * 5 + 3500)
    ],
    [sid('post', '007')]: [
      reaction('007-r01', pick(sid('person', '004')), '👍', -86400 * 4),
      reaction('007-r02', pick(sid('person', '005')), '👍', -86400 * 4 + 500),
      reaction('007-r03', pick(meId), '❤️', -86400 * 4 + 1000)
    ],
    [sid('post', '008')]: [
      reaction('008-r01', pick(sid('person', '006')), '👍', -86400 * 3),
      reaction('008-r02', pick(sid('person', '020')), '👍', -86400 * 3 + 500)
    ],
    [sid('post', '005')]: [
      reaction('005-r01', pick(sid('person', '002')), '👍', -86400 * 11),
      reaction('005-r02', pick(sid('person', '003')), '✅', -86400 * 11 + 500),
      reaction('005-r03', pick(meId), '🙌', -86400 * 11 + 1000)
    ],
    [sid('post', '003')]: [
      reaction('003-r01', pick(sid('person', '008')), '✅', -86400 * 7),
      reaction('003-r02', pick(sid('person', '009')), '👍', -86400 * 7 + 500),
      reaction('003-r03', pick(sid('person', '020')), '🌿', -86400 * 7 + 1000)
    ],
    [sid('post', 'simple-101')]: [
      reaction('101-r01', pick(meId), '👍', -86400 * 39),
      reaction('101-r02', pick(sid('person', 'starter', '002')), '👍', -86400 * 39 + 500)
    ],
    [sid('post', 'simple-102')]: [
      reaction('102-r01', pick(sid('person', 'starter', '002')), '👍', -86400 * 35),
      reaction('102-r02', pick(sid('person', 'starter', '003')), '👍', -86400 * 35 + 500),
      reaction('102-r03', pick(sid('person', 'starter', '001')), '👍', -86400 * 34),
      reaction('102-r04', pick(meId), '👍', -86400 * 34 + 500)
    ],
    [sid('post', 'simple-103')]: [
      reaction('103-r01', pick(sid('person', 'starter', '001')), '👍', -86400 * 33)
    ],
    [sid('post', 'simple-105')]: [
      reaction('105-r01', pick(sid('person', 'starter', '001')), '👍', -86400 * 44),
      reaction('105-r02', pick(sid('person', 'starter', '003')), '👍', -86400 * 43)
    ],
    [sid('post', 'simple-107')]: [
      reaction('107-r01', pick(sid('person', 'starter', '002')), '👍', -86400 * 27),
      reaction('107-r02', pick(sid('person', 'starter', '003')), '👍', -86400 * 26)
    ],
    [sid('post', 'simple-109')]: [
      reaction('109-r01', pick(meId), '👍', -86400 * 18)
    ],
    [sid('post', 'simple-111')]: [
      reaction('111-r01', pick(sid('person', 'starter', '003')), '👍', -86400 * 30)
    ],
    [sid('post', 'staff-201')]: [
      reaction('s201-r01', pick(sid('person', '004')), '👍', -86400 * 49),
      reaction('s201-r02', pick(sid('person', '002')), '👍', -86400 * 49 + 500),
      reaction('s201-r03', pick(sid('person', '003')), '❤️', -86400 * 48)
    ],
    [sid('post', 'staff-202')]: [
      reaction('s202-r01', pick(meId), '👍', -86400 * 41),
      reaction('s202-r02', pick(sid('person', '005')), '👍', -86400 * 41 + 500),
      reaction('s202-r03', pick(sid('person', '004')), '👍', -86400 * 40)
    ],
    [sid('post', 'staff-203')]: [
      reaction('s203-r01', pick(meId), '👍', -86400 * 39),
      reaction('s203-r02', pick(sid('person', '003')), '👍', -86400 * 39 + 500)
    ],
    [sid('post', 'staff-204')]: [
      reaction('s204-r01', pick(sid('person', '002')), '👍', -86400 * 35),
      reaction('s204-r02', pick(sid('person', '010')), '👍', -86400 * 35 + 500)
    ],
    [sid('post', 'staff-205')]: [
      reaction('s205-r01', pick(sid('person', '002')), '👍', -86400 * 33),
      reaction('s205-r02', pick(sid('person', '003')), '👍', -86400 * 33 + 500),
      reaction('s205-r03', pick(meId), '🙌', -86400 * 32),
      reaction('s205-r04', pick(sid('person', '010')), '👍', -86400 * 32 + 500)
    ],
    [sid('post', 'staff-206')]: [
      reaction('s206-r01', pick(sid('person', '005')), '👍', -86400 * 27),
      reaction('s206-r02', pick(sid('person', '007')), '👍', -86400 * 26)
    ],
    [sid('post', 'staff-207')]: [
      reaction('s207-r01', pick(sid('person', '002')), '👍', -86400 * 19),
      reaction('s207-r02', pick(sid('person', '004')), '👍', -86400 * 18)
    ],
    [sid('post', 'fr-001')]: [
      reaction('fr001-r01', pick(sid('person', '002')), '👍', -86400 * 4),
      reaction('fr001-r02', pick(sid('person', '007')), '👍', -86400 * 4 + 500),
      reaction('fr001-r03', pick(meId), '🌱', -86400 * 4 + 1000),
      reaction('fr001-r04', pick(sid('person', '010')), '👍', -86400 * 3),
      reaction('fr001-r05', pick(sid('person', '012')), '❤️', -86400 * 3 + 500)
    ],
    [sid('post', 'fr-002')]: [
      reaction('fr002-r01', pick(sid('person', '004')), '👍', -86400 * 3),
      reaction('fr002-r02', pick(meId), '👍', -86400 * 3 + 500),
      reaction('fr002-r03', pick(sid('person', '011')), '🌱', -86400 * 2)
    ],
    [sid('post', 'fr-003')]: [
      reaction('fr003-r01', pick(sid('person', '003')), '❤️', -86400 * 2),
      reaction('fr003-r02', pick(sid('person', '008')), '👍', -86400 * 2 + 500),
      reaction('fr003-r03', pick(sid('person', '012')), '👍', -86400 * 2 + 1000),
      reaction('fr003-r04', pick(meId), '🙌', -86400 * 1),
      reaction('fr003-r05', pick(sid('person', '005')), '👍', -86400 * 1 + 500),
      reaction('fr003-r06', pick(sid('person', '014')), '❤️', -86400)
    ],
    [sid('post', 'fr-004')]: [
      reaction('fr004-r01', pick(meId), '👍', -86400 * 1),
      reaction('fr004-r02', pick(sid('person', '006')), '❤️', -86400 * 1 + 500),
      reaction('fr004-r03', pick(sid('person', '002')), '👍', -86400),
      reaction('fr004-r04', pick(sid('person', '013')), '🌱', -86400 + 500)
    ],
    [sid('post', 'fr-005')]: [
      reaction('fr005-r01', pick(sid('person', '009')), '👍', -86400),
      reaction('fr005-r02', pick(sid('person', '015')), '👍', -86400 + 500)
    ]
  }
}

function reaction (num, user, emojiFull, createdAt_offset) {
  return {
    id: sid('reaction', num),
    userId: user?.id,
    user,
    emojiFull,
    emojiBase: emojiFull,
    emojiLabel: emojiFull,
    entityType: 'post',
    createdAt_offset
  }
}

/**
 * Proposal options and votes for proposal posts — based on real DB options.
 */
export function buildProposalData () {
  const post005 = sid('post', '005')
  const post010 = sid('post', '010')

  const options005 = [
    { id: sid('proposal-option', '005-01'), postId: post005, text: 'Agree — yes, let\'s move forward with the cooperative transition', emoji: '✅', color: '#4A90D9' },
    { id: sid('proposal-option', '005-02'), postId: post005, text: 'Abstain — need more information before deciding', emoji: '➡️', color: '#7B68EE' },
    { id: sid('proposal-option', '005-03'), postId: post005, text: 'Disagree — this is not the right time', emoji: '🟠', color: '#E89B3A' },
    { id: sid('proposal-option', '005-04'), postId: post005, text: 'Block — I have a serious concern that must be addressed first', emoji: '🔴', color: '#E05555' }
  ]

  const options010 = [
    { id: sid('proposal-option', '010-01'), postId: post010, text: 'Yes — open the monthly calls to non-members', emoji: '✅' },
    { id: sid('proposal-option', '010-02'), postId: post010, text: 'No — keep calls members-only for now', emoji: '🔴' },
    { id: sid('proposal-option', '010-03'), postId: post010, text: 'Modified — open occasional calls but keep most private', emoji: '➡️' }
  ]

  return {
    [post005]: {
      options: options005,
      votes: [
        vote('v005-01', sid('person', '002'), options005[0].id, post005, -86400 * 11),
        vote('v005-02', sid('person', '003'), options005[0].id, post005, -86400 * 11 + 500),
        vote('v005-03', sid('person', '004'), options005[1].id, post005, -86400 * 11 + 1000),
        vote('v005-04', sid('person', '005'), options005[0].id, post005, -86400 * 11 + 1500),
        vote('v005-05', ME_ID, options005[0].id, post005, -86400 * 11 + 2000)
      ],
      proposalStatus: 'voting',
      votingMethod: 'consensus'
    },
    [post010]: {
      options: options010,
      votes: [],
      proposalStatus: 'discussion',
      votingMethod: 'single'
    }
  }
}

function vote (id, userId, optionId, postId, createdAt_offset) {
  return { id: sid('vote', id), userId, optionId, postId, createdAt_offset }
}
