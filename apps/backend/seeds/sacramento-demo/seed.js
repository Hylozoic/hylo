/* eslint-disable camelcase */
/**
 * Inserts River City Mutual Aid with direct knex writes so no emails,
 * push notifications, or queue jobs are sent.
 */
const { DateTime } = require('luxon')
const bcrypt = require('bcrypt')
const crypto = require('crypto')
const { cast, demoEmails, NEIGHBORHOOD_LABEL, SKILL_POOL } = require('./people')
const { posts, chats, threads, trackActions, ALLOCATIONS, GRANT_KEYS } = require('./content')
const { loadImages } = require('./images')

const TZ = 'America/Los_Angeles'
const MARKER = 'sacramento-demo'
const PARENT_SLUG = 'river-city-mutual-aid'
const PASSWORD = 'neighbors!'
const BAY_SLUG = 'bay-area-bioregion'
const STANDIN_SLUG = 'bay-delta-bioregion-demo'

const TOPICS = ['general', 'food', 'gleaning', 'housing', 'furniture', 'rides', 'childcare', 'tools', 'heat', 'smoke', 'flood', 'seeds', 'welcome']

const EMOJIS = [
  { full: '❤️', base: '❤', label: 'red heart' },
  { full: '🙏', base: '🙏', label: 'folded hands' },
  { full: '🍋', base: '🍋', label: 'lemon' },
  { full: '👏', base: '👏', label: 'clapping hands' },
  { full: '💪', base: '💪', label: 'flexed biceps' }
]

const FILLER_EN = [
  'I can help with this on Saturday morning.',
  'Leaving a comment so it stays on my list.',
  'My neighbor asked about this too. I will send them here.',
  'Count me in if you still need a person.',
  'Thank you for posting it where people can actually find it.',
  'I have done this before. Happy to walk someone through it.',
  'Saving this. I will know more after work.',
  'This is exactly the kind of thing the network is for.',
  'I can bring a cooler if that helps.',
  'Checked with my household. We can do one of the days.',
  'Putting this in the group chat so the night shift sees it.',
  'Glad this is still open. I almost missed it.'
]

const FILLER_ES = [
  'Yo puedo el sábado por la mañana.',
  'Gracias por escribirlo aquí.',
  'Le aviso a mi vecina, ella también necesita esto.',
  'Cuenten conmigo si todavía falta gente.',
  'Lo vi en el grupo y quería decir que sí.'
]

const CENTERS = {
  oak: [38.548, -121.465],
  midtown: [38.576, -121.483],
  land: [38.545, -121.498],
  delpaso: [38.615, -121.445],
  westsac: [38.58, -121.53],
  arden: [38.602, -121.4],
  elkgrove: [38.425, -121.371]
}

const NEIGHBORHOOD_OPTION = {
  oak: 'Oak Park',
  midtown: 'Midtown & Downtown',
  land: 'Land Park & Curtis Park',
  delpaso: 'Del Paso Heights & North Sac'
}

const SYSTEM_ROLES = [
  {
    name: 'Administrator',
    emoji: '🪄',
    description: 'Administrators are empowered to do all group management and configuration.',
    responsibilities: ['Administration', 'Add Members', 'Remove Members', 'Manage Content']
  },
  {
    name: 'Moderator',
    emoji: '⚖️',
    description: 'Moderators are expected to actively engage in discussion, encourage participation, and take corrective action if a member violates group agreements.',
    responsibilities: ['Manage Content', 'Remove Members']
  },
  {
    name: 'Host',
    emoji: '👋',
    description: 'Hosts are responsible for cultivating a good atmosphere by welcoming and orienting new members.',
    responsibilities: ['Add Members']
  }
]

/**
 * Rebuild the demo inside one transaction. Safe to run again.
 * @param {import('knex').Knex} knex
 */
async function seedSacramentoDemo (knex) {
  const everyone = cast()
  if (everyone.length !== 101) {
    throw new Error(`Expected 101 people in the cast, found ${everyone.length}`)
  }
  assertAllocations()

  console.info('River City demo: loading photos')
  const images = await loadImages()
  const passwordHash = bcrypt.hashSync(PASSWORD, 10)
  const searchKind = await relationKind(knex, 'search_index')

  const summary = await knex.transaction(async trx => {
    const tibetRow = await trx('users').whereRaw('lower(email) = ?', ['tibet@terran.io']).first()
    if (!tibetRow) throw new Error('tibet@terran.io is not in this database. Log in once locally, then re-run.')

    console.info('River City demo: removing any previous copy')
    await teardown(trx, searchKind)

    console.info('River City demo: people')
    const people = await insertPeople(trx, everyone, tibetRow, passwordHash, images)

    console.info('River City demo: group, spaces, menu')
    const groups = await insertGroups(trx, people, images)

    console.info('River City demo: agreements, questions, skills, topics')
    await insertAgreements(trx, groups, people)
    await insertQuestions(trx, groups, people)
    await insertSkills(trx, groups, people)
    const tags = await insertTopics(trx, groups)

    console.info('River City demo: roles')
    const roles = await insertRoles(trx, groups, people)

    console.info('River City demo: posts')
    const made = await insertPosts(trx, groups, people, images, tags)

    console.info('River City demo: chat and messages')
    const chatNotes = await insertChats(trx, groups, people, images)
    await insertThreads(trx, people)

    console.info('River City demo: flow fund and onboarding track')
    await insertFunding(trx, groups, people, made, roles)
    await insertTrack(trx, groups, people)

    console.info('River City demo: Tibet notifications and peer group')
    await insertNotifications(trx, groups, people, made, chatNotes)
    await insertPeer(trx, groups, images)
    await recount(trx, groups, tibetRow.id)

    const members = await trx('group_memberships').where({ group_id: groups.parent.id, active: true }).count('* as n')
    return { members: Number(members[0].n), photos: Object.keys(images).length }
  })

  await refreshSearch(knex, searchKind)

  const base = process.env.DOMAIN ? `http://${process.env.DOMAIN}` : 'http://localhost:3000'
  console.info('')
  console.info(`River City is ready: ${base}/groups/${PARENT_SLUG}/requests-and-offers`)
  console.info(`Log in as tibet@terran.io. Other neighbors use their @example.com email and password ${PASSWORD}`)
  console.info(`${summary.members} members, ${summary.photos} photos.`)
}

/**
 * Fail if the hand-checked token table drifts.
 */
function assertAllocations () {
  const rows = Object.values(ALLOCATIONS)
  rows.forEach(row => {
    const sum = row.reduce((total, n) => total + n, 0)
    if (sum !== 100) throw new Error(`Allocation row sums to ${sum}`)
    if (row.some(n => n > 40)) throw new Error('Allocation exceeds 40')
  })
  const expected = [172, 155, 145, 138, 121, 110, 59]
  expected.forEach((want, index) => {
    const got = rows.reduce((total, row) => total + row[index], 0)
    if (got !== want) throw new Error(`Grant column ${index} sums to ${got}, expected ${want}`)
  })
}

/**
 * Delete the previous demo without touching Tibet or Bay Delta Bioregion.
 * @param {import('knex').Knex.Transaction} trx
 * @param {string|null} searchKind
 */
async function teardown (trx, searchKind) {
  const emails = demoEmails()
  const userIds = await trx('users').whereIn('email', emails.map(email => email.toLowerCase())).whereRaw('lower(email) <> ?', ['tibet@terran.io']).pluck('id')
  const parent = await trx('groups').where({ slug: PARENT_SLUG }).first('id')
  const groupIds = []
  if (parent) {
    groupIds.push(parent.id)
    const spaces = await trx('groups').where({ parent_id: parent.id }).pluck('id')
    groupIds.push(...spaces)
  }
  const standin = await trx('groups').where({ slug: STANDIN_SLUG }).first('id')
  if (standin) groupIds.push(standin.id)
  if (!groupIds.length && !userIds.length) return

  // Deletes fire deferred foreign keys, and this database checks activities
  // with a sequential scan. Skipping those checks keeps a rebuild to seconds.
  const relaxed = await relaxForeignKeys(trx)
  const postIds = await collectPostIds(trx, groupIds, userIds)
  const commentIds = postIds.length ? await trx('comments').whereIn('post_id', postIds).pluck('id') : []
  const locIds = await collectLocationIds(trx, groupIds, userIds, postIds)

  const activityQuery = trx('activities').where(function () {
    this.whereRaw("meta->>'sacramentoDemo' = 'true'")
    if (postIds.length) this.orWhereIn('post_id', postIds)
    if (commentIds.length) this.orWhereIn('comment_id', commentIds)
    if (groupIds.length) this.orWhereIn('group_id', groupIds)
  })
  const activityIds = await activityQuery.pluck('id')
  if (activityIds.length) await trx('notifications').whereIn('activity_id', activityIds).del()
  if (activityIds.length) await trx('activities').whereIn('id', activityIds).del()

  if (searchKind === 'r') await deleteSearchRows(trx, postIds, commentIds, userIds, groupIds)

  await del(trx, 'reactions', 'entity_id', postIds.concat(commentIds))
  await del(trx, 'media', 'post_id', postIds)
  if (commentIds.length) await trx('media').whereIn('comment_id', commentIds).del()
  await del(trx, 'contributions', 'post_id', postIds)
  await del(trx, 'proposal_votes', 'post_id', postIds)
  await del(trx, 'proposal_options', 'post_id', postIds)
  await del(trx, 'event_invitations', 'event_id', postIds)
  await del(trx, 'event_responses', 'post_id', postIds)
  await del(trx, 'collections_posts', 'post_id', postIds)
  await del(trx, 'group_view_pins', 'post_id', postIds)
  await del(trx, 'posts_tags', 'post_id', postIds)
  await del(trx, 'posts_users', 'post_id', postIds)
  await del(trx, 'groups_posts', 'post_id', postIds)
  await del(trx, 'posts_about_users', 'post_id', postIds)
  await del(trx, 'project_contributions', 'post_id', postIds)
  if (commentIds.length) {
    await trx('comments_tags').whereIn('comment_id', commentIds).del()
    await trx('comments').whereIn('post_id', postIds).whereNotNull('comment_id').del()
    await trx('comments').whereIn('post_id', postIds).del()
  }
  await del(trx, 'project_roles', 'post_id', postIds)
  if (postIds.length) {
    await trx('posts').whereIn('parent_post_id', postIds).del()
    await trx('posts').whereIn('id', postIds).del()
  }

  if (groupIds.length) {
    const viewIds = await trx('group_views').whereIn('group_id', groupIds).pluck('id')
    if (viewIds.length) {
      await trx('group_views_users').whereIn('view_id', viewIds).del()
      await trx('collections_posts').whereIn('view_id', viewIds).del()
      await trx('group_view_pins').whereIn('view_id', viewIds).del()
    }
    await trx('group_views').whereIn('group_id', groupIds).orWhereIn('linked_group_id', groupIds).del()
    await trx('group_memberships_group_roles').whereIn('group_id', groupIds).del()
    await trx('group_memberships').whereIn('group_id', groupIds).del()
    const roleIds = await trx('groups_roles').whereIn('group_id', groupIds).pluck('id')
    if (roleIds.length) await trx('group_roles_responsibilities').whereIn('group_role_id', roleIds).del()
    await trx('groups_roles').whereIn('group_id', groupIds).del()
    await trx('group_join_questions_answers').whereIn('group_id', groupIds).del()
    await trx('join_requests').whereIn('group_id', groupIds).del()
    await trx('users_groups_agreements').whereIn('group_id', groupIds).del()
    const agreementIds = await trx('groups_agreements').whereIn('group_id', groupIds).pluck('agreement_id')
    await trx('groups_agreements').whereIn('group_id', groupIds).del()
    if (agreementIds.length) {
      await trx('agreements').whereIn('id', agreementIds).whereNotExists(function () {
        this.select(trx.raw('1')).from('groups_agreements').whereRaw('groups_agreements.agreement_id = agreements.id')
      }).del()
    }
    const questionIds = await trx('group_join_questions').whereIn('group_id', groupIds).pluck('question_id')
    await trx('group_join_questions').whereIn('group_id', groupIds).del()
    if (questionIds.length) {
      await trx('questions').whereIn('id', questionIds).whereNotExists(function () {
        this.select(trx.raw('1')).from('group_join_questions').whereRaw('group_join_questions.question_id = questions.id')
      }).del()
    }
    await trx('groups_tags').whereIn('group_id', groupIds).del()
    await trx('groups_suggested_skills').whereIn('group_id', groupIds).del()
    await trx('tag_follows').whereIn('group_id', groupIds).del()
    await trx('groups').whereIn('id', groupIds).update({ track_id: null, funding_round_id: null })
    await trx('tracks').whereIn('group_id', groupIds).del()
    await trx('funding_rounds').whereIn('group_id', groupIds).del()
    await trx('group_relationships').whereIn('parent_group_id', groupIds).orWhereIn('child_group_id', groupIds).del()
    await trx('groups').whereIn('parent_id', groupIds).del()
    await trx('groups').whereIn('id', groupIds).del()
  }

  if (userIds.length) {
    await trx('skills_users').whereIn('user_id', userIds).del()
    await trx('linked_account').whereIn('user_id', userIds).del()
    await trx('group_memberships_group_roles').whereIn('user_id', userIds).del()
    await trx('group_memberships').whereIn('user_id', userIds).del()
    await trx('users').whereIn('id', userIds).whereRaw('lower(email) <> ?', ['tibet@terran.io']).del()
  }
  if (locIds.length) {
    await trx('locations').whereIn('id', locIds).whereNotExists(function () {
      this.select(trx.raw('1')).from('users').whereRaw('users.location_id = locations.id')
    }).whereNotExists(function () {
      this.select(trx.raw('1')).from('groups').whereRaw('groups.location_id = locations.id')
    }).whereNotExists(function () {
      this.select(trx.raw('1')).from('posts').whereRaw('posts.location_id = locations.id')
    }).del()
  }
  if (relaxed) await trx.raw('set local session_replication_role = origin')
}

/**
 * Superuser-only. Turns foreign-key checks off for the deletes in this transaction.
 * @returns {Promise<boolean>}
 */
async function relaxForeignKeys (trx) {
  const result = await trx.raw('select rolsuper from pg_roles where rolname = current_user')
  if (!result.rows[0] || !result.rows[0].rolsuper) {
    console.log('River City demo: a rebuild checks every foreign key, so it can take several minutes')
    return false
  }
  await trx.raw('set local session_replication_role = replica')
  return true
}

/**
 * Post ids that belong to this demo.
 * @returns {Promise<Array<string|number>>}
 */
async function collectPostIds (trx, groupIds, userIds) {
  const ids = new Set()
  const marked = await trx('posts').where({ created_from: MARKER }).pluck('id')
  marked.forEach(id => ids.add(id))
  if (groupIds.length) {
    const linked = await trx('groups_posts').whereIn('group_id', groupIds).pluck('post_id')
    linked.forEach(id => ids.add(id))
  }
  if (userIds.length) {
    const threadsByUsers = await trx('posts').where({ type: 'thread' }).whereIn('user_id', userIds).pluck('id')
    threadsByUsers.forEach(id => ids.add(id))
  }
  return [...ids]
}

/**
 * Location rows created for demo people, posts, and groups.
 * @returns {Promise<Array<string|number>>}
 */
async function collectLocationIds (trx, groupIds, userIds, postIds) {
  const ids = new Set()
  if (userIds.length) {
    const rows = await trx('users').whereIn('id', userIds).whereNotNull('location_id').pluck('location_id')
    rows.forEach(id => ids.add(id))
  }
  if (groupIds.length) {
    const rows = await trx('groups').whereIn('id', groupIds).whereNotNull('location_id').pluck('location_id')
    rows.forEach(id => ids.add(id))
  }
  if (postIds.length) {
    const rows = await trx('posts').whereIn('id', postIds).whereNotNull('location_id').pluck('location_id')
    rows.forEach(id => ids.add(id))
  }
  return [...ids]
}

/**
 * Remove demo rows from a plain search_index table.
 */
async function deleteSearchRows (trx, postIds, commentIds, userIds, groupIds) {
  if (postIds.length) await trx('search_index').whereIn('post_id', postIds).del()
  if (commentIds.length) await trx('search_index').whereIn('comment_id', commentIds).del()
  if (userIds.length) await trx('search_index').whereIn('user_id', userIds).del()
  if (groupIds.length) await trx('search_index').whereIn('group_id', groupIds).del()
}

/**
 * Create the cast. Tibet is reused.
 * @returns {Promise<Record<string, object>>}
 */
async function insertPeople (trx, everyone, tibetRow, passwordHash, images) {
  const byKey = {}
  for (let index = 0; index < everyone.length; index++) {
    const member = everyone[index]
    if (member.existing) {
      byKey[member.key] = { ...member, id: tibetRow.id, name: tibetRow.name }
      continue
    }
    const joined = joinDate(member, index)
    const [lat, lng] = jitter(index, CENTERS[member.neighborhood])
    const neighborhood = NEIGHBORHOOD_LABEL[member.neighborhood]
    const fullText = `${neighborhood}, Sacramento, California`
    const locationId = await insertLocation(trx, { lat, lng, fullText, neighborhood })
    const [first, ...rest] = member.name.split(' ')
    const [row] = await trx('users').insert({
      email: member.email.toLowerCase(),
      name: member.name,
      first_name: first,
      last_name: rest.join(' '),
      avatar_url: images.portraits[member.key],
      active: true,
      email_validated: true,
      created_at: joined,
      updated_at: joined,
      bio: member.tagline,
      tagline: member.tagline,
      location: fullText.slice(0, 255),
      location_id: locationId,
      settings: asJson(trx, { locale: member.spanish ? 'es' : 'en', sacramentoDemo: true }),
      last_active_at: member.recent || member.pending ? minutesAgo(30 + index) : joined,
      calendar_token: crypto.randomUUID()
    }).returning('id')
    const id = idOf(row)
    await trx('linked_account').insert({
      user_id: id,
      provider_key: 'password',
      provider_user_id: passwordHash
    })
    byKey[member.key] = { ...member, id, locationId }
  }
  return byKey
}

/**
 * Parent group, nine spaces, and the menu.
 * @returns {Promise<object>}
 */
async function insertGroups (trx, people, images) {
  const now = new Date()
  const parentLocation = await insertLocation(trx, {
    lat: 38.5816,
    lng: -121.4944,
    fullText: 'Sacramento, California',
    neighborhood: 'Sacramento'
  })
  const parentId = await insertGroup(trx, {
    name: 'River City Mutual Aid',
    slug: PARENT_SLUG,
    purpose: 'Neighbors across the Sacramento region meeting each other\'s needs: sharing what we have, asking for what we need, and getting ready together for heat, smoke and floods.',
    description: 'We\'re a network of neighbors, not a charity. Post a request when you need something, an offer when you have something to share, and map the fruit trees, fridges and free pantries around you. Gifts, loans and trades only, never sales.',
    visibility: 2,
    accessibility: 1,
    created_by_id: people.tibet.id,
    location: 'Sacramento, California',
    location_id: parentLocation,
    avatar_url: images.marks['river-city'],
    banner_url: images.banner || null,
    settings: parentSettings(now),
    type_descriptor: 'Network',
    type_descriptor_plural: 'Networks',
    steward_descriptor: 'Weaver',
    steward_descriptor_plural: 'Weavers',
    allow_in_public: true,
    home_route: '/requests-and-offers',
    icon: 'hand-heart',
    geo: polygon([[-121.56, 38.42], [-121.33, 38.4], [-121.32, 38.62], [-121.38, 38.7], [-121.55, 38.68], [-121.58, 38.55]]),
    num_open_join_requests: 1
  })

  const spaceDefs = [
    space('oak-park', 'Oak Park', 'trees', 'rosa', 'Broadway, Stockton, 14th Ave, and the freeway.', images.oak, polygon([[-121.498, 38.535], [-121.448, 38.535], [-121.448, 38.562], [-121.498, 38.562]]), null, '/chat'),
    space('midtown', 'Midtown & Downtown', 'building-2', 'tibet', 'Business 80, Alhambra, Broadway, and the river.', images.midtown, polygon([[-121.51, 38.568], [-121.46, 38.568], [-121.46, 38.592], [-121.505, 38.592]]), null, '/chat'),
    space('land-park', 'Land Park & Curtis Park', 'flower-2', 'lin', 'Broadway, the freeway, Sutterville, and Freeport.', images.land, polygon([[-121.51, 38.528], [-121.485, 38.528], [-121.485, 38.558], [-121.505, 38.558]]), null, '/chat'),
    space('del-paso', 'Del Paso Heights & North Sac', 'sprout', 'marcus', 'The Marysville corridor, Arcade Creek down to Grand.', images.delpaso, polygon([[-121.47, 38.595], [-121.42, 38.595], [-121.42, 38.65], [-121.47, 38.65]]), null, '/chat'),
    space('gleaning', 'Gleaning Crew', 'apple', 'hannah', 'Region-wide. Fruit that would otherwise fall on the sidewalk.', images.gleaning, null, ['resource', 'event', 'request', 'offer', 'discussion'], '/chat'),
    space('tools', 'Tool Library', 'wrench', 'jorge', 'Borrow tools from the Oak Park shed. Write your name and bring them back.', images.tools, null, ['resource', 'request', 'offer'], '/resources', { lat: 38.5472, lng: -121.4554, fullText: '5th Ave & 40th St, Sacramento, California' }),
    space('ready', 'Ready Sac: Heat, Smoke & Flood', 'umbrella', 'walt', 'Getting ready together for heat, smoke, and floods.', images.readysac, null, null, '/chat'),
    space('grants', 'Neighbor Grants: Fall Flow Fund', 'coins', 'rosa', 'Ten neighbors each allocate 100 tokens across small grants. Each token is $5 of a $5,000 pool.', images.grants, null, null, '/funding-round-submissions', null, 'voting'),
    space('welcome', 'Welcome to River City', 'door-open', 'hannah', 'Five short steps for people who just arrived.', images.welcome, null, null, '/track-actions')
  ]

  const byKey = { parent: { id: parentId, slug: PARENT_SLUG } }
  for (const def of spaceDefs) {
    let locationId = null
    let location = null
    if (def.pin) {
      locationId = await insertLocation(trx, def.pin)
      location = def.pin.fullText
    }
    const id = await insertGroup(trx, {
      name: def.name,
      slug: `${PARENT_SLUG}-${def.key}`,
      purpose: def.purpose,
      description: def.purpose,
      type: 'space',
      parent_id: parentId,
      visibility: 2,
      accessibility: 1,
      created_by_id: people[def.host].id,
      avatar_url: images.marks[def.key],
      banner_url: def.banner || null,
      settings: asJson(trx, { layout: 'two-column', sacramentoDemo: true }),
      icon: def.icon,
      home_route: def.home,
      accepted_post_types: def.accepted ? asJson(trx, def.accepted) : null,
      geo: def.geo,
      location,
      location_id: locationId,
      status: def.status || 'published'
    })
    byKey[def.key] = { id, slug: `${PARENT_SLUG}-${def.key}`, key: def.key }
  }

  const views = {}
  for (const def of spaceDefs) {
    const specs = viewSpecsFor(def.key)
    const inserted = await insertViews(trx, byKey[def.key].id, specs)
    Object.assign(views, inserted)
  }

  const parentViews = [
    { type: 'requests-and-offers', settings: { defaultViewMode: 'cards' } },
    { type: 'map' },
    { type: 'chat', key: 'parent:chat' },
    { type: 'events' },
    { type: 'resources' },
    { type: 'custom', key: 'parent:fruit', name: 'Fruit to Glean', icon: 'Apple', topics: ['gleaning'], settings: { defaultViewMode: 'cards', postTypes: ['resource'] } },
    { type: 'discussions', key: 'parent:discussions' },
    { type: 'proposals' },
    { type: 'members' },
    { type: 'text', name: 'Neighborhoods' },
    { type: 'space', name: 'Oak Park', linked: byKey['oak-park'].id },
    { type: 'space', name: 'Midtown & Downtown', linked: byKey.midtown.id },
    { type: 'space', name: 'Land Park & Curtis Park', linked: byKey['land-park'].id },
    { type: 'space', name: 'Del Paso Heights & North Sac', linked: byKey['del-paso'].id },
    { type: 'text', name: 'Working groups' },
    { type: 'space', name: 'Gleaning Crew', linked: byKey.gleaning.id },
    { type: 'space', name: 'Tool Library', linked: byKey.tools.id },
    { type: 'space', name: 'Ready Sac: Heat, Smoke & Flood', linked: byKey.ready.id },
    { type: 'space', name: 'Neighbor Grants: Fall Flow Fund', linked: byKey.grants.id },
    { type: 'space', name: 'Welcome to River City', linked: byKey.welcome.id },
    { type: 'welcome', key: 'parent:welcome', page: welcomeHtml() }
  ]
  Object.assign(views, await insertViews(trx, parentId, parentViews))

  await trx('groups').where({ id: parentId }).update({ menu_view_count: parentViews.length, more_spaces_count: 0 })
  for (const def of spaceDefs) {
    const count = viewSpecsFor(def.key).length
    await trx('groups').where({ id: byKey[def.key].id }).update({ menu_view_count: count, more_spaces_count: 0 })
  }

  const trackId = await insertTrackRow(trx, byKey.welcome.id)
  const roundId = await insertRoundRow(trx, byKey.grants.id)
  await trx('groups').where({ id: byKey.welcome.id }).update({ track_id: trackId })
  await trx('groups').where({ id: byKey.grants.id }).update({ funding_round_id: roundId })

  return { parent: { id: parentId, slug: PARENT_SLUG }, byKey, views, trackId, roundId }
}

/**
 * Four agreements, accepted by current members.
 */
async function insertAgreements (trx, groups, people) {
  const items = [
    ['Solidarity, not charity.', 'Everyone has needs and everyone has something to give.'],
    ['Gifts, loans and trades.', 'No selling or advertising.'],
    ['Protect each other\'s privacy.', 'Share exact addresses in DMs, not in posts. Ask before posting photos of people or homes.'],
    ['Close the loop.', 'Mark your post fulfilled and thank who helped, so the network can see what\'s working.']
  ]
  const acceptedAt = daysAgo(50)
  for (let order = 0; order < items.length; order++) {
    const [title, description] = items[order]
    const [row] = await trx('agreements').insert({ title, description, created_at: acceptedAt, updated_at: acceptedAt }).returning('id')
    const agreementId = idOf(row)
    await trx('groups_agreements').insert({
      group_id: groups.parent.id,
      agreement_id: agreementId,
      active: true,
      order,
      created_at: acceptedAt,
      updated_at: acceptedAt
    })
    const members = Object.values(people).filter(person => !person.pending)
    for (const person of members) {
      await trx('users_groups_agreements').insert({
        group_id: groups.parent.id,
        agreement_id: agreementId,
        user_id: person.id,
        accepted: true,
        created_at: acceptedAt,
        updated_at: acceptedAt
      })
    }
  }
}

/**
 * Join questions, plus Dana Ortiz's pending request.
 */
async function insertQuestions (trx, groups, people) {
  const prompts = [
    ['Which neighborhood do you live in or near?', 'Arden-Arcade'],
    ['What\'s one thing you could share with neighbors (a skill, a tool, time)?', 'Weekday morning rides, and I know the bus routes.'],
    ['How did you hear about us?', 'A coworker in Oak Park.']
  ]
  const questionIds = []
  for (const [text] of prompts) {
    const [row] = await trx('questions').insert({ text, created_at: daysAgo(50) }).returning('id')
    const questionId = idOf(row)
    questionIds.push(questionId)
    await trx('group_join_questions').insert({
      group_id: groups.parent.id,
      question_id: questionId,
      created_at: daysAgo(50),
      updated_at: daysAgo(50)
    })
  }
  const [request] = await trx('join_requests').insert({
    user_id: people.dana.id,
    group_id: groups.parent.id,
    status: 0,
    created_at: daysAgo(1),
    updated_at: daysAgo(1)
  }).returning('id')
  for (let i = 0; i < prompts.length; i++) {
    await trx('group_join_questions_answers').insert({
      question_id: questionIds[i],
      join_request_id: idOf(request),
      answer: prompts[i][1],
      group_id: groups.parent.id,
      user_id: people.dana.id,
      created_at: daysAgo(1),
      updated_at: daysAgo(1)
    })
  }
}

/**
 * Suggested skills on the network, and skills on each profile.
 */
async function insertSkills (trx, groups, people) {
  const skillIds = {}
  for (const name of SKILL_POOL) skillIds[name] = await findOrCreateSkill(trx, name)
  for (const name of Object.keys(skillIds)) {
    await trx('groups_suggested_skills').insert({
      group_id: groups.parent.id,
      skill_id: skillIds[name],
      created_at: daysAgo(50)
    })
  }
  for (const person of Object.values(people)) {
    const names = person.skills || []
    for (const name of names) {
      const skillId = skillIds[name] || await findOrCreateSkill(trx, name)
      const exists = await trx('skills_users').where({ skill_id: skillId, user_id: person.id, type: 0 }).first()
      if (!exists) await trx('skills_users').insert({ skill_id: skillId, user_id: person.id, type: 0 })
    }
  }
}

/**
 * Topics on the parent group.
 * @returns {Promise<Record<string, number>>}
 */
async function insertTopics (trx, groups) {
  const tags = {}
  for (const name of TOPICS) {
    tags[name] = await findOrCreateTag(trx, name)
    await trx('groups_tags').insert({
      group_id: groups.parent.id,
      tag_id: tags[name],
      created_at: daysAgo(50),
      updated_at: daysAgo(50),
      is_default: name === 'general',
      num_followers: 0
    })
  }
  return tags
}

/**
 * System roles plus Neighborhood Host and Flow Funder.
 * @returns {Promise<Record<string, number>>}
 */
async function insertRoles (trx, groups, people) {
  const responsibilities = {}
  const rows = await trx('responsibilities').where({ type: 'system' }).select('id', 'title')
  rows.forEach(row => { responsibilities[row.title] = row.id })
  const roles = {}
  const now = new Date()
  for (const def of SYSTEM_ROLES) {
    const [row] = await trx('groups_roles').insert({
      group_id: groups.parent.id,
      name: def.name,
      emoji: def.emoji,
      description: def.description,
      type: 'system',
      active: true,
      created_at: now,
      updated_at: now
    }).returning('id')
    roles[def.name.toLowerCase()] = idOf(row)
    for (const title of def.responsibilities) {
      if (!responsibilities[title]) continue
      await trx('group_roles_responsibilities').insert({
        group_role_id: roles[def.name.toLowerCase()],
        responsibility_id: responsibilities[title]
      })
    }
  }
  roles['neighborhood-host'] = await insertCustomRole(trx, groups.parent.id, 'Neighborhood Host', '🏡', 'Hosts a neighborhood or working-group space.', ['Manage Content'], responsibilities)
  roles['flow-funder'] = await insertCustomRole(trx, groups.parent.id, 'Flow Funder', '🌊', 'Allocates tokens in the Fall Flow Fund.', [], responsibilities)

  const seen = new Set()
  for (const person of Object.values(people)) {
    if (person.pending) continue
    await addMembership(trx, groups.parent.id, person, seen, person.key === 'tibet' ? new Date() : joinDate(person, 0))
    for (const spaceKey of person.spaces || []) {
      const space = groups.byKey[spaceKey]
      if (!space) continue
      const extra = {}
      if (person.key === 'tibet' && spaceKey === 'oak-park') extra.new_post_count = 2
      await addMembership(trx, space.id, person, seen, null, extra)
    }
    for (const roleKey of person.roles || []) {
      await trx('group_memberships_group_roles').insert({
        user_id: person.id,
        group_id: groups.parent.id,
        group_role_id: roles[roleKey],
        active: true,
        created_at: now,
        updated_at: now
      })
    }
  }
  return roles
}

/**
 * Posts, comments, reactions, RSVPs, votes, and contributions.
 * @returns {Promise<Record<string, object>>}
 */
async function insertPosts (trx, groups, people, images, tags) {
  const made = {}
  const list = posts()
  const roster = Object.values(people).filter(person => !person.pending)
  let reactionTotal = 0
  let commentTotal = 0

  for (const post of list) {
    const author = people[post.by]
    const created = post.hoursAgo ? hoursAgo(post.hoursAgo) : at(post.at)
    let locationId = null
    if (post.lat != null) {
      locationId = await insertLocation(trx, {
        lat: post.lat,
        lng: post.lng,
        fullText: `${post.place}, Sacramento, California`,
        neighborhood: post.place
      })
    }
    const fulfilledAt = post.fulfilled ? at(post.fulfilled.at) : null
    const [row] = await trx('posts').insert({
      name: post.title,
      description: rich(post.details, post.mention ? people[post.mention] : null),
      type: post.type,
      created_at: created,
      updated_at: created,
      user_id: author.id,
      active: true,
      visibility: 0,
      is_public: !!post.isPublic,
      location: post.place ? `${post.place}, Sacramento, California`.slice(0, 255) : null,
      location_id: locationId,
      fulfilled_at: fulfilledAt,
      created_from: MARKER,
      start_time: post.start ? at(post.start) : (post.type === 'proposal' ? created : null),
      end_time: post.end ? at(post.end) : (post.closes ? at(post.closes) : null),
      timezone: post.type === 'event' || post.type === 'proposal' ? TZ : null,
      tag_names: (post.topics || []).slice(0, 3),
      num_comments: 0,
      num_commenters: 0,
      num_people_reacts: 0,
      proposal_status: post.type === 'proposal' ? (post.completed ? 'completed' : 'voting') : null,
      proposal_outcome: post.completed ? 'successful' : null,
      voting_method: post.type === 'proposal' ? 'single' : null,
      quorum: post.quorum || null,
      budget: post.budget ? `$${post.budget}` : null,
      accept_contributions: post.type === 'project'
    }).returning('id')
    const postId = idOf(row)
    made[post.key] = { id: postId, created, authorId: author.id }

    const groupIds = [groups.parent.id]
    for (const spaceKey of post.spaces || []) {
      if (groups.byKey[spaceKey]) groupIds.push(groups.byKey[spaceKey].id)
    }
    for (const groupId of [...new Set(groupIds)]) {
      await trx('groups_posts').insert({ post_id: postId, group_id: groupId })
    }
    await ensureFollower(trx, postId, author.id, { following: true, last_read_at: created })

    for (const topic of (post.topics || []).slice(0, 3)) {
      if (!tags[topic]) continue
      await trx('posts_tags').insert({ post_id: postId, tag_id: tags[topic], created_at: created, updated_at: created, selected: true })
    }
    if (post.image && images[post.image]) {
      await trx('media').insert({ post_id: postId, type: 'image', url: images[post.image], created_at: created, position: 0 })
    }
    if (post.fulfilled) {
      for (const key of post.fulfilled.by) {
        await trx('contributions').insert({ post_id: postId, user_id: people[key].id, contributed_at: fulfilledAt })
      }
    }
    if (post.pin && groups.views['parent:discussions']) {
      await trx('group_view_pins').insert({ view_id: groups.views['parent:discussions'], post_id: postId, pinned_at: created })
    }
    if (post.members) {
      const [roleRow] = await trx('project_roles').insert({ name: 'member', post_id: postId }).returning('id')
      for (const key of post.members) {
        await ensureFollower(trx, postId, people[key].id, { following: true, project_role_id: idOf(roleRow), last_read_at: created })
      }
    }
    if (post.options) {
      const optionIds = []
      for (const [text, emoji] of post.options) {
        const [option] = await trx('proposal_options').insert({ post_id: postId, text, emoji, color: null }).returning('id')
        optionIds.push(idOf(option))
      }
      let cursor = 0
      const voters = roster.filter(person => person.id !== author.id)
      for (let optionIndex = 0; optionIndex < post.votes.length; optionIndex++) {
        for (let n = 0; n < post.votes[optionIndex]; n++) {
          const voter = voters[cursor % voters.length]
          cursor += 1
          await trx('proposal_votes').insert({ post_id: postId, option_id: optionIds[optionIndex], user_id: voter.id, created_at: created })
        }
      }
    }
    if (post.type === 'event') {
      await insertRsvps(trx, post, postId, author, people, roster, created)
    }

    const comments = [...(post.comments || [])]
    const target = post.commentTarget || comments.length
    let fillerIndex = 0
    while (comments.length < target) {
      const spanish = (post.spaces || []).some(space => space === 'oak-park' || space === 'del-paso') && fillerIndex % 4 === 0
      const pool = roster.filter(person => person.id !== author.id && (!spanish || person.spanish))
      const speaker = pool[fillerIndex % pool.length] || roster[fillerIndex % roster.length]
      comments.push({
        by: speaker.key,
        text: spanish ? FILLER_ES[fillerIndex % FILLER_ES.length] : FILLER_EN[fillerIndex % FILLER_EN.length],
        synthetic: true,
        fillerIndex
      })
      fillerIndex += 1
    }

    let latest = created
    const commenterIds = new Set()
    for (let i = 0; i < comments.length; i++) {
      const comment = comments[i]
      const when = comment.at ? at(comment.at) : new Date(created.getTime() + ((i + 1) / (comments.length + 1)) * (Date.now() - created.getTime() - 3600000))
      if (when > latest) latest = when
      const commenter = people[comment.by]
      const [commentRow] = await trx('comments').insert({
        user_id: commenter.id,
        post_id: postId,
        created_at: when,
        text: rich(comment.text, comment.mention ? people[comment.mention] : null),
        active: true,
        created_from: MARKER
      }).returning('id')
      const commentId = idOf(commentRow)
      commenterIds.add(commenter.id)
      commentTotal += 1
      if (post.key === 'O1' && comment.by === 'hannah') made.ladderComment = { id: commentId, postId, at: when }
      if (post.key === 'E3' && comment.by === 'walt') made.sandbagComment = { id: commentId, postId, at: when }
      if (post.key === 'R6' && comment.reactions) made.jobComment = { id: commentId }
      const added = await addReactions(trx, 'comment', commentId, comment.reactions || 0, roster, commenter.id, i, comment.emoji)
      reactionTotal += added
      await ensureFollower(trx, postId, commenter.id, { following: true, last_read_at: when })
    }

    const postReactions = post.reactions != null ? post.reactions : (post.type === 'submission' ? 2 : 4)
    const added = await addReactions(trx, 'post', postId, postReactions, roster, author.id, reactionTotal)
    reactionTotal += added
    const summary = await reactionSummary(trx, postId)
    await trx('posts').where({ id: postId }).update({
      num_comments: comments.length,
      num_commenters: commenterIds.size,
      num_people_reacts: summary.count,
      reactions_summary: summary.map,
      updated_at: latest
    })
    if (post.key === 'O1') {
      await trx('posts_users').where({ post_id: postId, user_id: people.tibet.id }).update({ last_read_at: new Date(latest.getTime() - 3600000) })
    }
  }

  const project = made.J1
  for (const key of ['R2', 'R3', 'R4', 'R5', 'O2']) {
    if (!made[key] || !project) continue
    await trx('posts').where({ id: made[key].id }).update({
      parent_post_id: project.id,
      is_project_request: key.startsWith('R')
    })
  }

  made.commentTotal = commentTotal
  made.reactionTotal = reactionTotal
  await topUp(trx, made, roster, people)
  return made
}

/**
 * Add comments and reactions until the network feels dense.
 */
async function topUp (trx, made, roster, people) {
  const postIds = Object.entries(made).filter(([key, value]) => value && value.id && !key.startsWith('G') && key !== 'R16' && key !== 'ladderComment' && key !== 'sandbagComment' && key !== 'jobComment').map(([, value]) => value.id)
  let comments = made.commentTotal
  let guard = 0
  while (comments < 140 && guard < 400) {
    const postId = postIds[guard % postIds.length]
    const speaker = roster[guard % roster.length]
    const when = hoursAgo(5 + (guard % 40))
    await trx('comments').insert({
      user_id: speaker.id,
      post_id: postId,
      created_at: when,
      text: rich(FILLER_EN[guard % FILLER_EN.length]),
      active: true,
      created_from: MARKER
    })
    comments += 1
    guard += 1
  }
  let reactions = made.reactionTotal
  guard = 0
  while (reactions < 430 && guard < 800) {
    const postId = postIds[guard % postIds.length]
    const added = await addReactions(trx, 'post', postId, 1, roster, people.tibet.id, reactions + guard)
    reactions += added
    guard += 1
    if (!added) break
  }
  await refreshPostStats(trx)
}

/**
 * Chat rooms. Returns the Oak Park mention post for Tibet's notification.
 * @returns {Promise<object>}
 */
async function insertChats (trx, groups, people, images) {
  const notes = {}
  let previousOakId = null
  for (const room of chats()) {
    const group = room.room === 'parent' ? groups.parent : groups.byKey[room.room]
    for (const message of room.messages) {
      const when = message.minutesAgo ? minutesAgo(message.minutesAgo) : at(message.at)
      const author = people[message.by]
      const [row] = await trx('posts').insert({
        description: rich(message.text, message.mention ? people[message.mention] : null),
        type: 'chat',
        created_at: when,
        updated_at: when,
        user_id: author.id,
        active: true,
        visibility: 0,
        created_from: MARKER,
        num_comments: 0
      }).returning('id')
      const postId = idOf(row)
      await trx('groups_posts').insert({ post_id: postId, group_id: group.id })
      await ensureFollower(trx, postId, author.id, { following: true, last_read_at: when })
      if (message.image && images[message.image]) {
        await trx('media').insert({ post_id: postId, type: 'image', url: images[message.image], created_at: when, position: 0 })
      }
      if (room.room === 'oak-park' && message.mention === 'tibet') {
        notes.oakMention = { id: postId, at: when, previousId: previousOakId }
      }
      if (room.room === 'oak-park') previousOakId = postId
    }
  }
  if (notes.oakMention && groups.views['oak-park:chat']) {
    await trx('group_views_users').insert({
      view_id: groups.views['oak-park:chat'],
      user_id: people.tibet.id,
      new_post_count: 2,
      last_read_post_id: notes.oakMention.previousId,
      created_at: new Date(),
      updated_at: new Date()
    })
  }
  return notes
}

/**
 * Direct messages. Three threads stay unread for Tibet.
 */
async function insertThreads (trx, people) {
  for (const thread of threads()) {
    const messages = thread.messages
    const last = messages[messages.length - 1]
    const lastAt = last.minutesAgo ? minutesAgo(last.minutesAgo) : at(last.at)
    const starter = people[messages[0].by]
    const [row] = await trx('posts').insert({
      type: 'thread',
      created_at: at(messages[0].at) || lastAt,
      updated_at: lastAt,
      user_id: starter.id,
      active: true,
      visibility: 0,
      created_from: MARKER
    }).returning('id')
    const postId = idOf(row)
    for (const key of thread.people) {
      const readAt = thread.unread && key === 'tibet' ? new Date(lastAt.getTime() - 60000) : lastAt
      await ensureFollower(trx, postId, people[key].id, { following: true, last_read_at: readAt })
    }
    for (const message of messages) {
      const when = message.minutesAgo ? minutesAgo(message.minutesAgo) : at(message.at)
      await trx('comments').insert({
        user_id: people[message.by].id,
        post_id: postId,
        created_at: when,
        text: rich(message.text),
        active: true,
        created_from: MARKER
      })
    }
  }
}

/**
 * Token allocations for the nine funders who already voted. Tibet has not.
 */
async function insertFunding (trx, groups, people, made, roles) {
  await trx('funding_rounds').where({ id: groups.roundId }).update({
    voter_roles: asJson(trx, [{ id: Number(roles['flow-funder']) }]),
    num_submissions: GRANT_KEYS.length,
    num_participants: await memberCount(trx, groups.byKey.grants.id)
  })
  const funders = Object.keys(ALLOCATIONS)
  for (const key of funders) {
    for (let index = 0; index < GRANT_KEYS.length; index++) {
      const postId = made[GRANT_KEYS[index]].id
      const tokens = ALLOCATIONS[key][index]
      await ensureFollower(trx, postId, people[key].id, { following: true, tokens_allocated_to: tokens, active: true })
    }
    await mergeMembershipSettings(trx, groups.byKey.grants.id, people[key].id, { tokensRemaining: 0 })
  }
  await mergeMembershipSettings(trx, groups.byKey.grants.id, people.tibet.id, { tokensRemaining: 100 })
}

/**
 * Welcome track: 41 enrolled, 23 finished, 3 mid-way.
 */
async function insertTrack (trx, groups, people) {
  const actions = trackActions()
  if (!groups.views['welcome:track-actions']) throw new Error('Welcome track is missing its steps view')
  const actionIds = []
  const hannah = people.hannah
  for (let index = 0; index < actions.length; index++) {
    const action = actions[index]
    const created = daysAgo(50 - index)
    const [row] = await trx('posts').insert({
      name: action.title,
      description: rich(action.details),
      type: 'action',
      created_at: created,
      updated_at: created,
      user_id: hannah.id,
      active: true,
      visibility: 0,
      created_from: MARKER,
      completion_action: action.completion,
      completion_action_settings: asJson(trx, action.settings)
    }).returning('id')
    const postId = idOf(row)
    actionIds.push(postId)
    await trx('groups_posts').insert({ post_id: postId, group_id: groups.byKey.welcome.id })
    await trx('collections_posts').insert({
      post_id: postId,
      user_id: hannah.id,
      view_id: groups.views['welcome:track-actions'],
      order: index,
      created_at: created,
      updated_at: created
    })
  }

  const enrolled = Object.values(people).filter(person => !person.pending && (person.spaces || []).includes('welcome'))
  const ordered = [people.tibet, ...enrolled.filter(person => person.key !== 'tibet')].slice(0, 41)
  const completed = new Set(ordered.slice(0, 23).map(person => person.key))
  let mid = ordered.filter(person => person.supporting && person.recent && !completed.has(person.key)).slice(0, 3)
  if (mid.length < 3) {
    mid = ordered.filter(person => !completed.has(person.key)).slice(0, 3)
  }
  const midKeys = new Set(mid.map(person => person.key))

  for (const person of ordered) {
    const doneAll = completed.has(person.key)
    const doneSome = midKeys.has(person.key)
    if (doneAll) {
      await mergeMembershipSettings(trx, groups.byKey.welcome.id, person.id, { completedAt: daysAgo(12).toISOString() })
    }
    for (let step = 0; step < actionIds.length; step++) {
      const finished = doneAll || (doneSome && step < 2) || (!doneAll && !doneSome && step === 0)
      if (!finished) continue
      const response = stepResponse(actions[step], person)
      await ensureFollower(trx, actionIds[step], person.id, {
        following: true,
        completed_at: daysAgo(40 - step),
        completion_response: asJson(trx, response)
      })
      if (actions[step].completion === 'comment') {
        await trx('comments').insert({
          user_id: person.id,
          post_id: actionIds[step],
          created_at: daysAgo(40 - step),
          text: rich(response[0]),
          active: true,
          created_from: MARKER
        })
      }
    }
  }

  await trx('tracks').where({ id: groups.trackId }).update({
    num_actions: actionIds.length,
    num_people_enrolled: ordered.length,
    num_people_completed: completed.size,
    completion_role_id: null
  })
  for (let step = 0; step < actionIds.length; step++) {
    const count = await trx('posts_users').where({ post_id: actionIds[step] }).whereNotNull('completed_at').count('* as n')
    await trx('posts').where({ id: actionIds[step] }).update({ num_people_completed: Number(count[0].n) })
  }
}

/**
 * Four unread items in Tibet's bell, matching the demo script.
 */
async function insertNotifications (trx, groups, people, made, chatNotes) {
  const items = []
  if (made.ladderComment) {
    items.push({
      actor_id: people.hannah.id,
      reader_id: people.tibet.id,
      post_id: made.ladderComment.postId,
      comment_id: made.ladderComment.id,
      group_id: groups.parent.id,
      created_at: made.ladderComment.at,
      meta: { reasons: ['newComment'], sacramentoDemo: true }
    })
  }
  items.push({
    actor_id: people.dana.id,
    reader_id: people.tibet.id,
    group_id: groups.parent.id,
    created_at: daysAgo(1),
    meta: { reasons: ['joinRequest'], sacramentoDemo: true }
  })
  if (chatNotes.oakMention) {
    items.push({
      actor_id: people.rosa.id,
      reader_id: people.tibet.id,
      post_id: chatNotes.oakMention.id,
      group_id: groups.byKey['oak-park'].id,
      created_at: chatNotes.oakMention.at,
      meta: { reasons: ['mention'], sacramentoDemo: true }
    })
  }
  if (made.sandbagComment) {
    items.push({
      actor_id: people.walt.id,
      reader_id: people.tibet.id,
      post_id: made.sandbagComment.postId,
      comment_id: made.sandbagComment.id,
      group_id: groups.byKey.ready.id,
      created_at: made.sandbagComment.at,
      meta: { reasons: ['commentMention'], sacramentoDemo: true }
    })
  }
  for (const item of items) {
    const [row] = await trx('activities').insert({ ...item, unread: true, meta: asJson(trx, item.meta) }).returning('id')
    await trx('notifications').insert({
      activity_id: idOf(row),
      user_id: people.tibet.id,
      medium: 0,
      created_at: item.created_at,
      updated_at: item.created_at,
      sent_at: item.created_at
    })
  }
}

/**
 * Peer link to the real Bay Delta group, or a small stand-in.
 */
async function insertPeer (trx, groups, images) {
  let bay = await trx('groups').where({ slug: BAY_SLUG, active: true }).first('id')
  if (!bay) {
    const id = await insertGroup(trx, {
      name: 'Bay Delta Bioregion',
      slug: STANDIN_SLUG,
      purpose: 'A stand-in so River City can show a peer group on the map.',
      description: 'Placeholder created by the River City demo because Bay Delta Bioregion was not in this database.',
      visibility: 2,
      accessibility: 1,
      created_by_id: null,
      settings: asJson(trx, { sacramentoDemo: true, layout: 'two-column' }),
      home_route: '/all',
      avatar_url: images.marks['bay-delta']
    })
    bay = { id }
  }
  await trx('group_relationships').insert({
    parent_group_id: groups.parent.id,
    child_group_id: bay.id,
    relationship_type: 1,
    active: true,
    created_at: daysAgo(40),
    updated_at: daysAgo(40)
  })
}

/**
 * Member counts and Tibet's unread badge.
 */
async function recount (trx, groups, tibetId) {
  const ids = [groups.parent.id, ...Object.values(groups.byKey).map(group => group.id)]
  for (const id of [...new Set(ids)]) {
    const rows = await trx('group_memberships').where({ group_id: id, active: true }).count('* as n')
    await trx('groups').where({ id }).update({ num_members: Number(rows[0].n) })
  }
  // The badge is an unseen counter, not a count of every historical unread activity.
  await trx.raw(
    `update users set new_notification_count = (
      select count(*) from activities
      where reader_id = users.id and unread = true and meta->>'sacramentoDemo' = 'true'
    ) where id = ?`,
    [tibetId]
  )
}

/**
 * Event invitations and RSVPs.
 */
async function insertRsvps (trx, post, postId, author, people, roster, created) {
  const going = new Set(post.going || [])
  const interested = new Set(post.interested || [])
  if (post.goingCount) {
    const preferred = roster.filter(person => (post.spaces || []).some(space => (person.spaces || []).includes(space)))
    for (const person of preferred.concat(roster)) {
      if (going.size >= post.goingCount) break
      if (!interested.has(person.key)) going.add(person.key)
    }
  }
  const responses = new Map()
  going.forEach(key => responses.set(key, 'yes'))
  interested.forEach(key => { if (!responses.has(key)) responses.set(key, 'interested') })
  if (post.inviteTibet && !responses.has('tibet')) responses.set('tibet', null)
  for (const [key, response] of responses) {
    const person = people[key]
    if (!person) continue
    await trx('event_invitations').insert({
      user_id: person.id,
      inviter_id: author.id,
      event_id: postId,
      response,
      created_at: created,
      updated_at: created
    })
  }
}

/**
 * Insert a group row and return its id.
 * @returns {Promise<number|string>}
 */
async function insertGroup (trx, attrs) {
  const now = new Date()
  const [row] = await trx('groups').insert({
    active: true,
    created_at: attrs.created_at || daysAgo(60),
    updated_at: now,
    name: attrs.name,
    slug: attrs.slug,
    description: attrs.description,
    purpose: attrs.purpose,
    visibility: attrs.visibility,
    accessibility: attrs.accessibility,
    created_by_id: attrs.created_by_id,
    settings: jsonValue(trx, attrs.settings || {}),
    num_members: 0,
    num_open_join_requests: attrs.num_open_join_requests || 0,
    type: attrs.type || null,
    parent_id: attrs.parent_id || null,
    avatar_url: attrs.avatar_url,
    banner_url: attrs.banner_url,
    location: attrs.location,
    location_id: attrs.location_id,
    type_descriptor: attrs.type_descriptor || null,
    type_descriptor_plural: attrs.type_descriptor_plural || null,
    steward_descriptor: attrs.steward_descriptor || null,
    steward_descriptor_plural: attrs.steward_descriptor_plural || null,
    allow_in_public: !!attrs.allow_in_public,
    home_route: attrs.home_route,
    icon: attrs.icon || null,
    accepted_post_types: attrs.accepted_post_types || null,
    geo_shape: attrs.geo ? trx.raw('ST_SetSRID(ST_GeomFromGeoJSON(?), 4326)', [attrs.geo]) : null,
    access_code: crypto.randomBytes(4).toString('hex'),
    calendar_token: crypto.randomUUID(),
    status: attrs.status || 'published'
  }).returning('id')
  return idOf(row)
}

/**
 * Menu views inside one group. Keys are stored for later lookups.
 * @returns {Promise<Record<string, number>>}
 */
async function insertViews (trx, groupId, specs) {
  const ids = {}
  const now = new Date()
  for (let index = 0; index < specs.length; index++) {
    const spec = specs[index]
    const [row] = await trx('group_views').insert({
      group_id: groupId,
      type: spec.type,
      name: spec.name || null,
      icon: spec.icon || null,
      order: index,
      page_content: spec.page || null,
      linked_group_id: spec.linked || null,
      topics: asJson(trx, spec.topics || []),
      settings: spec.settings ? asJson(trx, spec.settings) : null,
      created_at: now,
      updated_at: now
    }).returning('id')
    ids[spec.key || spec.type] = idOf(row)
  }
  return ids
}

/**
 * Views for a space. The first one is its home.
 * @param {string} key
 * @returns {object[]}
 */
function viewSpecsFor (key) {
  const chat = { type: 'chat', key: `${key}:chat` }
  const members = { type: 'members' }
  if (key === 'grants') {
    return [
      { type: 'funding-round-submissions' },
      chat,
      members,
      { type: 'welcome', page: grantsWelcome() }
    ]
  }
  if (key === 'welcome') {
    return [
      { type: 'track-actions', key: 'welcome:track-actions' },
      chat,
      members,
      { type: 'welcome', page: '<p>Five steps. When you finish, you\'re ready to join in.</p>' }
    ]
  }
  if (key === 'tools') {
    return [
      { type: 'resources', settings: { defaultViewMode: 'map' } },
      chat,
      { type: 'requests-and-offers' },
      members
    ]
  }
  if (key === 'gleaning') {
    return [
      chat,
      { type: 'resources', settings: { defaultViewMode: 'map' } },
      { type: 'events' },
      { type: 'requests-and-offers' },
      members
    ]
  }
  if (key === 'ready') {
    return [chat, { type: 'events' }, { type: 'requests-and-offers' }, { type: 'proposals' }, { type: 'discussions' }, members]
  }
  return [chat, { type: 'requests-and-offers' }, { type: 'map' }, { type: 'events' }, { type: 'resources' }, members]
}

/**
 * Empty track row. The space points back at it after both exist.
 * @returns {Promise<number|string>}
 */
async function insertTrackRow (trx, groupId) {
  const created = daysAgo(50)
  const [row] = await trx('tracks').insert({
    group_id: groupId,
    action_descriptor: 'Step',
    action_descriptor_plural: 'Steps',
    completion_message: '<p>You\'re in! Your neighbors are glad you\'re here.</p><p>¡Bienvenido! Nos alegra tenerte aquí.</p>',
    created_at: created,
    updated_at: created,
    num_actions: 0,
    num_people_enrolled: 0,
    num_people_completed: 0
  }).returning('id')
  return idOf(row)
}

/**
 * Funding round row. Voter role is filled in after roles exist.
 * @returns {Promise<number|string>}
 */
async function insertRoundRow (trx, groupId) {
  const [row] = await trx('funding_rounds').insert({
    group_id: groupId,
    criteria: '<p>Benefits more than one household. Led by someone who lives here. Budget under $1,000.</p>',
    require_budget: true,
    voting_method: 'token_allocation_constant',
    token_type: 'Tokens',
    total_tokens: 100,
    min_token_allocation: 0,
    max_token_allocation: 40,
    submissions_open_at: at([-21, 9, 0]),
    submissions_close_at: at([-7, 18, 0]),
    voting_opens_at: at([-2, 9, 0]),
    voting_closes_at: at([5, 18, 0]),
    allow_self_voting: false,
    show_realtime_votes: true,
    show_realtime_submissions: false,
    submitter_roles: asJson(trx, []),
    voter_roles: asJson(trx, []),
    created_at: at([-24, 10, 0]),
    updated_at: new Date()
  }).returning('id')
  return idOf(row)
}

/**
 * Custom role on the parent group.
 * @returns {Promise<number|string>}
 */
async function insertCustomRole (trx, groupId, name, emoji, description, responsibilityTitles, responsibilities) {
  const now = new Date()
  const [row] = await trx('groups_roles').insert({
    group_id: groupId,
    name,
    emoji,
    description,
    type: 'custom',
    active: true,
    created_at: now,
    updated_at: now
  }).returning('id')
  const id = idOf(row)
  for (const title of responsibilityTitles) {
    if (!responsibilities[title]) continue
    await trx('group_roles_responsibilities').insert({ group_role_id: id, responsibility_id: responsibilities[title] })
  }
  return id
}

/**
 * One active membership. Skips duplicates.
 */
async function addMembership (trx, groupId, person, seen, createdAt, extraColumns = {}) {
  const key = `${groupId}:${person.id}`
  if (seen.has(key)) return
  seen.add(key)
  const when = createdAt || joinDate(person, seen.size)
  await trx('group_memberships').insert({
    group_id: groupId,
    user_id: person.id,
    active: true,
    created_at: when,
    updated_at: when,
    new_post_count: extraColumns.new_post_count || 0,
    settings: asJson(trx, {
      lastReadAt: person.key === 'tibet' ? new Date().toISOString() : when.toISOString(),
      showJoinForm: false,
      joinQuestionsAnsweredAt: when.toISOString(),
      agreementsAcceptedAt: when.toISOString(),
      sendEmail: true,
      sendPushNotifications: false,
      postNotifications: 'important'
    })
  })
}

/**
 * Merge keys into an existing membership settings object.
 */
async function mergeMembershipSettings (trx, groupId, userId, patch) {
  const membership = await trx('group_memberships').where({ group_id: groupId, user_id: userId }).first()
  if (!membership) return
  const settings = readJson(membership.settings)
  await trx('group_memberships').where({ id: membership.id }).update({ settings: asJson(trx, { ...settings, ...patch }) })
}

/**
 * Follow a post, or update the pivot when the row is already there.
 */
async function ensureFollower (trx, postId, userId, attrs) {
  const existing = await trx('posts_users').where({ post_id: postId, user_id: userId }).first()
  const now = new Date()
  if (existing) {
    await trx('posts_users').where({ id: existing.id }).update({ ...attrs, updated_at: now })
    return
  }
  await trx('posts_users').insert({
    post_id: postId,
    user_id: userId,
    active: true,
    following: true,
    created_at: now,
    updated_at: now,
    ...attrs
  })
}

/**
 * Reactions for one post or comment. Skips people who already reacted.
 * @returns {Promise<number>}
 */
async function addReactions (trx, entityType, entityId, count, roster, authorId, salt, onlyEmoji) {
  if (!count) return 0
  const existing = new Set(
    (await trx('reactions').where({ entity_type: entityType, entity_id: entityId }).pluck('user_id')).map(String)
  )
  let added = 0
  for (let n = 0; n < roster.length && added < count; n++) {
    const person = roster[(salt + n) % roster.length]
    if (String(person.id) === String(authorId)) continue
    if (existing.has(String(person.id))) continue
    const emoji = onlyEmoji ? EMOJIS.find(item => item.full === onlyEmoji) || EMOJIS[0] : EMOJIS[(salt + n) % EMOJIS.length]
    await trx('reactions').insert({
      user_id: person.id,
      entity_id: entityId,
      entity_type: entityType,
      date_reacted: new Date(),
      emoji_full: emoji.full,
      emoji_base: emoji.base,
      emoji_label: emoji.label
    })
    existing.add(String(person.id))
    added += 1
  }
  return added
}

/**
 * Count and summary map for reactions on a post.
 * @returns {Promise<{count: number, map: object}>}
 */
async function reactionSummary (trx, postId) {
  const rows = await trx('reactions').where({ entity_type: 'post', entity_id: postId }).select('emoji_full')
  const map = {}
  rows.forEach(row => { map[row.emoji_full] = (map[row.emoji_full] || 0) + 1 })
  return { count: rows.length, map }
}

/**
 * What a person submits for one track step.
 * @returns {string[]}
 */
function stepResponse (action, person) {
  if (action.completion === 'selectOne') return [NEIGHBORHOOD_OPTION[person.neighborhood] || 'None yet']
  if (action.completion === 'text' || action.completion === 'comment') {
    const placeName = NEIGHBORHOOD_LABEL[person.neighborhood] || 'Sacramento'
    return [`${person.name.split(' ')[0]} in ${placeName}. ${person.tagline || 'Glad to be here.'}`]
  }
  return ['done']
}

/**
 * Parent group settings from the demo plan.
 * @param {Date} now
 */
function parentSettings (now) {
  return {
    allow_group_invites: true,
    public_member_directory: false,
    layout: 'two-column',
    showWelcomePage: true,
    locationDisplayPrecision: 'near',
    showSuggestedSkills: true,
    askJoinQuestions: true,
    defaultDigestFrequency: 'daily',
    publishMurmurationsProfile: false,
    showPostNoticesInChat: true,
    agreements_last_updated_at: daysAgo(50).toISOString(),
    sacramentoDemo: true,
    seededAt: now.toISOString()
  }
}

/**
 * Welcome page shown to new members, in English and Spanish.
 * @returns {string}
 */
function welcomeHtml () {
  return [
    '<p>A note from the Weavers. This is a network of neighbors. Post a request when you need something, an offer when you have something to share, and put fruit trees, fridges, and pantries on the map.</p>',
    '<p>Una nota de las tejedoras. Somos una red de vecinas y vecinos. Pide lo que necesitas, ofrece lo que puedes compartir, y marca en el mapa los árboles, la heladera y las despensas.</p>',
    '<p><strong>How to use this network.</strong> Ask. Offer. Map a resource. Join your neighborhood space.</p>',
    '<p><a href="/groups/river-city-mutual-aid/spaces/oak-park">Oak Park</a> · <a href="/groups/river-city-mutual-aid/spaces/midtown">Midtown &amp; Downtown</a> · <a href="/groups/river-city-mutual-aid/spaces/land-park">Land Park &amp; Curtis Park</a> · <a href="/groups/river-city-mutual-aid/spaces/del-paso">Del Paso Heights &amp; North Sac</a></p>'
  ].join('')
}

/**
 * Short bilingual note on the flow fund.
 * @returns {string}
 */
function grantsWelcome () {
  return '<p>Ten trusted neighbors each have 100 tokens. Each token is $5 of the $5,000 pool. Spread them across the proposals. You can see the totals move while voting is open.</p><p>Diez vecinas y vecinos tienen 100 fichas cada quien. Cada ficha vale $5 de un fondo de $5,000. Se ven los totales mientras la votación está abierta.</p>'
}

/**
 * A space definition used while building groups.
 */
function space (key, name, icon, host, purpose, banner, geo, accepted, home, pin, status) {
  return { key, name, icon, host, purpose, banner, geo, accepted, home, pin, status }
}

/**
 * Closed GeoJSON polygon. Coordinates are [lng, lat].
 * @param {number[][]} ring
 * @returns {string}
 */
function polygon (ring) {
  const closed = ring.slice()
  const first = closed[0]
  const last = closed[closed.length - 1]
  if (first[0] !== last[0] || first[1] !== last[1]) closed.push(first)
  return JSON.stringify({ type: 'Polygon', coordinates: [closed] })
}

/**
 * Location row with a point.
 * @returns {Promise<number|string>}
 */
async function insertLocation (trx, { lat, lng, fullText, neighborhood }) {
  const now = new Date()
  const [row] = await trx('locations').insert({
    center: trx.raw('ST_SetSRID(ST_MakePoint(?, ?), 4326)', [lng, lat]),
    full_text: String(fullText).slice(0, 255),
    city: 'Sacramento',
    region: 'California',
    country: 'United States',
    country_code: 'US',
    neighborhood: neighborhood ? String(neighborhood).slice(0, 255) : null,
    accuracy: 'place',
    created_at: now,
    updated_at: now
  }).returning('id')
  return idOf(row)
}

/**
 * Spread pins around a neighborhood center so the map is not one dot.
 * @returns {[number, number]}
 */
function jitter (index, center) {
  const angle = index * 2.399963
  const radius = 0.004 + (index % 5) * 0.0015
  return [center[0] + Math.cos(angle) * radius, center[1] + Math.sin(angle) * radius]
}

/**
 * When this person joined. About 55% of supporting neighbors are recent.
 * @returns {Date}
 */
function joinDate (member, index) {
  if (member.pending) return daysAgo(1)
  if (member.supporting && member.recent) return daysAgo(5 + (index % 160))
  if (member.supporting) return daysAgo(200 + (index % 400))
  return daysAgo(80 + (index % 200))
}

/**
 * Find a skill by name or create it.
 * @returns {Promise<number|string>}
 */
async function findOrCreateSkill (trx, name) {
  const found = await trx('skills').whereRaw('lower(name) = ?', [name.toLowerCase()]).first('id')
  if (found) return found.id
  const [row] = await trx('skills').insert({ name }).returning('id')
  return idOf(row)
}

/**
 * Find a tag by name or create it.
 * @returns {Promise<number|string>}
 */
async function findOrCreateTag (trx, name) {
  const found = await trx('tags').whereRaw('lower(name) = ?', [name.toLowerCase()]).first('id')
  if (found) return found.id
  const now = new Date()
  const [row] = await trx('tags').insert({ name, created_at: now, updated_at: now }).returning('id')
  return idOf(row)
}

/**
 * Active member count for a group.
 * @returns {Promise<number>}
 */
async function memberCount (trx, groupId) {
  const rows = await trx('group_memberships').where({ group_id: groupId, active: true }).count('* as n')
  return Number(rows[0].n)
}

/**
 * HTML paragraph, with an optional mention link.
 * @param {string} text
 * @param {object} [mentionPerson]
 * @returns {string}
 */
function rich (text, mentionPerson) {
  let safe = esc(text)
  if (mentionPerson) {
    const link = `<a class="mention" data-type="mention" data-id="${mentionPerson.id}" data-label="${esc(mentionPerson.name)}">${esc(mentionPerson.name)}</a>`
    const first = esc(mentionPerson.name.split(' ')[0])
    if (safe.includes(first)) safe = safe.replace(first, link)
    else safe = `${link} ${safe}`
  }
  return `<p>${safe}</p>`
}

/**
 * Escape text that will sit inside HTML we generate.
 * @param {string} value
 * @returns {string}
 */
function esc (value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/**
 * Bind a JS value as jsonb. Arrays must not go through node-pg as Postgres arrays.
 * @returns {import('knex').Knex.Raw}
 */
function asJson (trx, value) {
  return trx.raw('?::jsonb', [JSON.stringify(value)])
}

/**
 * jsonb binding. Leaves an existing knex raw value alone.
 * @returns {import('knex').Knex.Raw}
 */
function jsonValue (trx, value) {
  if (value && typeof value.toSQL === 'function') return value
  return asJson(trx, value)
}

/**
 * Recount comments and reactions after the filler pass.
 */
async function refreshPostStats (trx) {
  await trx.raw(`
    update posts p set
      num_comments = sub.n,
      num_commenters = sub.people
    from (
      select post_id, count(*)::int as n, count(distinct user_id)::int as people
      from comments
      where active = true and post_id in (select id from posts where created_from = ?)
      group by post_id
    ) sub
    where p.id = sub.post_id
  `, [MARKER])
  const ids = await trx('posts').where({ created_from: MARKER }).whereNotIn('type', ['chat', 'thread', 'action']).pluck('id')
  for (const id of ids) {
    const summary = await reactionSummary(trx, id)
    await trx('posts').where({ id }).update({
      num_people_reacts: summary.count,
      reactions_summary: summary.map
    })
  }
}

/**
 * Parse a jsonb column that might already be an object.
 * @returns {object}
 */
function readJson (value) {
  if (!value) return {}
  if (typeof value === 'string') return JSON.parse(value)
  return value
}

/**
 * Id from a knex returning() row.
 * @returns {number|string}
 */
function idOf (row) {
  if (row && typeof row === 'object') return row.id
  return row
}

/**
 * Day offset from this morning in Sacramento, at a clock time.
 * @param {number[]} spec
 * @returns {Date}
 */
function at (spec) {
  const [day, hour, minute] = spec
  return DateTime.now().setZone(TZ).startOf('day').plus({ days: day, hours: hour, minutes: minute || 0 }).toJSDate()
}

/**
 * Midnight-based date N days ago.
 * @param {number} days
 * @returns {Date}
 */
function daysAgo (days) {
  return DateTime.now().setZone(TZ).startOf('day').minus({ days }).plus({ hours: 10 }).toJSDate()
}

/**
 * A timestamp this many hours before now.
 * @param {number} hours
 * @returns {Date}
 */
function hoursAgo (hours) {
  return DateTime.now().setZone(TZ).minus({ hours }).toJSDate()
}

/**
 * A timestamp this many minutes before now.
 * @param {number} minutes
 * @returns {Date}
 */
function minutesAgo (minutes) {
  return DateTime.now().setZone(TZ).minus({ minutes }).toJSDate()
}

/**
 * Delete rows in chunks. No-op when there are no ids.
 */
async function del (trx, table, column, ids) {
  if (!ids || !ids.length) return
  const chunk = 500
  for (let i = 0; i < ids.length; i += chunk) {
    await trx(table).whereIn(column, ids.slice(i, i + chunk)).del()
  }
}

/**
 * pg_class.relkind for a relation, or null.
 * @returns {Promise<string|null>}
 */
async function relationKind (knex, name) {
  const result = await knex.raw('select relkind from pg_class where relname = ?', [name])
  return result.rows[0] ? result.rows[0].relkind : null
}

/**
 * Refresh the search index when it is a materialized view.
 */
async function refreshSearch (knex, kind) {
  if (kind !== 'm') return
  try {
    await knex.raw('refresh materialized view search_index')
  } catch (err) {
    console.info('Search index was not refreshed:', err.message)
  }
}

module.exports = { seedSacramentoDemo }
