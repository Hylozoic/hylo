/* eslint-disable camelcase */
/**
 * Build one demo group from a JSON spec. Dates are relative to the morning the script runs.
 */
const { DateTime } = require('luxon')
const bcrypt = require('bcrypt')
const crypto = require('crypto')
const { validateDemoSpec } = require('./validate')
const { teardownDemo, ensureTeardownIndexes, captureInvitedMembers, restoreInvitedMembers, markerFor } = require('./teardown')

const VISIBILITY = { hidden: 0, protected: 1, public: 2 }
const ACCESSIBILITY = { closed: 0, restricted: 1, open: 2 }

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
 * Rebuild a demo inside one transaction.
 * @param {import('knex').Knex} knex
 * @param {object} spec
 * @returns {Promise<object>}
 */
async function buildDemo (knex, spec) {
  const errors = validateDemoSpec(spec)
  if (errors.length) {
    const error = new Error(errors.slice(0, 12).join('\n'))
    error.errors = errors
    throw error
  }

  const h = clock(spec)
  const marker = markerFor(spec)
  const secret = spec.password || crypto.randomBytes(24).toString('hex')
  const passwordHash = bcrypt.hashSync(secret, 10)
  const searchKind = await relationKind(knex, 'search_index')
  await ensureTeardownIndexes(knex)

  const summary = await knex.transaction(async trx => {
    const real = await trx('users').whereRaw('lower(email) = ?', [spec.realUserEmail.toLowerCase()]).first()
    if (!real) throw new Error(`${spec.realUserEmail} is not in this database. Log in once, then re-run.`)

    const invited = await captureInvitedMembers(trx, spec)
    console.info(`${spec.name}: removing any previous copy`)
    await teardownDemo(trx, spec, searchKind)

    console.info(`${spec.name}: people`)
    const people = await insertPeople(trx, spec, h, real, passwordHash)

    console.info(`${spec.name}: group, spaces, menu`)
    const groups = await insertGroups(trx, spec, h, people)

    console.info(`${spec.name}: agreements, questions, skills, topics`)
    await insertAgreements(trx, spec, h, groups, people)
    await insertQuestions(trx, spec, h, groups, people)
    await insertSkills(trx, spec, groups, people)
    const tags = await insertTopics(trx, spec, h, groups)

    console.info(`${spec.name}: roles`)
    const roles = await insertRoles(trx, spec, h, groups, people)

    console.info(`${spec.name}: posts`)
    const made = await insertPosts(trx, spec, h, groups, people, tags, marker)

    console.info(`${spec.name}: chat and messages`)
    const chatNotes = await insertChats(trx, spec, h, groups, people, marker)
    await insertThreads(trx, spec, h, people, marker)

    console.info(`${spec.name}: flow fund and onboarding track`)
    if (spec.funding) await insertFunding(trx, spec, groups, people, made, roles)
    if (spec.welcomeTrack) await insertTrack(trx, spec, h, groups, people, marker)

    console.info(`${spec.name}: notifications and peer group`)
    await insertNotifications(trx, spec, h, groups, people, made, chatNotes)
    if (spec.peer) await insertPeer(trx, spec, h, groups)
    const kept = await restoreInvitedMembers(trx, invited, value => asJson(trx, value))
    await recount(trx, spec, groups, real.id)

    const members = await trx('group_memberships').where({ group_id: groups.parent.id, active: true }).count('* as n')
    const posts = await trx('posts').where({ created_from: marker }).count('* as n')
    const access = await trx('groups').where({ id: groups.parent.id }).first('access_code')
    const accessCode = access && access.access_code
    return {
      members: Number(members[0].n),
      posts: Number(posts[0].n),
      invited: kept,
      accessCode,
      slug: spec.group.slug,
      invitePath: `/groups/${spec.group.slug}/join/${accessCode}`
    }
  })

  await refreshSearch(knex, searchKind)
  return summary
}

/**
 * Create the cast. The real user is reused and not rewritten.
 * @returns {Promise<Record<string, object>>}
 */
async function insertPeople (trx, spec, h, real, passwordHash) {
  const byKey = {}
  for (let index = 0; index < spec.people.length; index++) {
    const member = spec.people[index]
    if (member.realUser) {
      byKey[member.key] = { ...member, id: real.id, name: real.name }
      continue
    }
    const joined = joinDate(h, member, index)
    const label = (spec.neighborhoods[member.neighborhood] && spec.neighborhoods[member.neighborhood].label) || member.neighborhood
    const [lat, lng] = jitter(index, spec.centers[member.neighborhood])
    const fullText = `${label}, ${spec.place.personSuffix}`
    const city = spec.place.personCity === 'neighborhood' ? label : spec.place.city
    const locationId = await insertLocation(trx, spec, { lat, lng, fullText, neighborhood: label, city })
    const [first, ...rest] = member.name.split(' ')
    const [row] = await trx('users').insert({
      email: member.email.toLowerCase(),
      name: member.name,
      first_name: first,
      last_name: rest.join(' '),
      avatar_url: member.portraitUrl,
      active: true,
      email_validated: true,
      created_at: joined,
      updated_at: joined,
      bio: member.tagline,
      tagline: member.tagline,
      location: fullText.slice(0, 255),
      location_id: locationId,
      settings: asJson(trx, { locale: member.locale || 'en', demo: spec.slug }),
      last_active_at: member.recent || member.pending ? h.minutesAgo(30 + index) : joined,
      calendar_token: crypto.randomUUID()
    }).returning('id')
    byKey[member.key] = { ...member, id: idOf(row), locationId }
  }
  return byKey
}

/**
 * Parent group, spaces, and the menu.
 * @returns {Promise<object>}
 */
async function insertGroups (trx, spec, h, people) {
  const now = new Date()
  const visibility = visibilityOf(spec.group.visibility)
  const parentLocation = await insertLocation(trx, spec, {
    lat: spec.group.location.lat,
    lng: spec.group.location.lng,
    fullText: spec.group.location.fullText,
    neighborhood: spec.group.location.neighborhood,
    city: spec.group.location.city || spec.place.city
  })
  const parentId = await insertGroup(trx, spec, h, {
    name: spec.group.name,
    slug: spec.group.slug,
    purpose: spec.group.purpose,
    description: spec.group.description || spec.group.purpose,
    visibility,
    accessibility: ACCESSIBILITY[spec.group.accessibility || 'restricted'],
    created_by_id: people[realKey(spec)].id,
    location: spec.group.location.fullText,
    location_id: parentLocation,
    avatar_url: spec.images.marks[spec.group.markKey],
    banner_url: spec.images[spec.group.bannerKey] || null,
    settings: parentSettings(spec, h, now),
    type_descriptor: spec.group.typeDescriptor || null,
    type_descriptor_plural: spec.group.typeDescriptorPlural || null,
    steward_descriptor: spec.group.stewardDescriptor || null,
    steward_descriptor_plural: spec.group.stewardDescriptorPlural || null,
    allow_in_public: spec.group.allowInPublic != null ? !!spec.group.allowInPublic : visibility === VISIBILITY.public,
    home_route: spec.group.homeRoute || '/requests-and-offers',
    icon: spec.group.icon || null,
    geo: polygon(spec.group.polygon),
    num_open_join_requests: spec.group.numOpenJoinRequests || 0
  })

  const byKey = { parent: { id: parentId, slug: spec.group.slug } }
  for (const def of spec.spaces) {
    let locationId = null
    let location = null
    if (def.pin) {
      locationId = await insertLocation(trx, spec, def.pin)
      location = def.pin.fullText
    }
    const markKey = def.markKey || def.key
    const id = await insertGroup(trx, spec, h, {
      name: def.name,
      slug: `${spec.group.slug}-${def.key}`,
      purpose: def.purpose,
      description: def.purpose,
      type: 'space',
      parent_id: parentId,
      visibility,
      accessibility: ACCESSIBILITY.restricted,
      created_by_id: people[def.host].id,
      avatar_url: spec.images.marks[markKey],
      banner_url: def.bannerKey ? spec.images[def.bannerKey] : null,
      settings: { layout: 'two-column', demo: spec.slug },
      icon: def.icon,
      home_route: def.home,
      accepted_post_types: def.accepted || null,
      geo: def.polygon ? polygon(def.polygon) : null,
      location,
      location_id: locationId,
      status: def.status || 'published'
    })
    byKey[def.key] = { id, slug: `${spec.group.slug}-${def.key}`, key: def.key }
  }

  const views = {}
  for (const def of spec.spaces) {
    const inserted = await insertViews(trx, byKey[def.key].id, resolveViews(def.views || [], byKey))
    Object.assign(views, inserted)
    await trx('groups').where({ id: byKey[def.key].id }).update({
      menu_view_count: (def.views || []).length,
      more_spaces_count: 0
    })
  }
  const parentViews = resolveViews(spec.group.menu || [], byKey)
  Object.assign(views, await insertViews(trx, parentId, parentViews))
  await trx('groups').where({ id: parentId }).update({ menu_view_count: parentViews.length, more_spaces_count: 0 })

  let trackId = null
  let roundId = null
  if (spec.welcomeTrack && byKey[spec.welcomeTrack.space]) {
    trackId = await insertTrackRow(trx, h, byKey[spec.welcomeTrack.space].id, spec.welcomeTrack)
    await trx('groups').where({ id: byKey[spec.welcomeTrack.space].id }).update({ track_id: trackId })
  }
  if (spec.funding && byKey[spec.funding.space]) {
    roundId = await insertRoundRow(trx, spec, h, byKey[spec.funding.space].id)
    await trx('groups').where({ id: byKey[spec.funding.space].id }).update({ funding_round_id: roundId })
  }

  const access = await trx('groups').where({ id: parentId }).first('access_code')
  return { parent: { id: parentId, slug: spec.group.slug, accessCode: access.access_code }, byKey, views, trackId, roundId }
}

/**
 * Agreements, accepted by current members.
 */
async function insertAgreements (trx, spec, h, groups, people) {
  const acceptedAt = h.daysAgo(50)
  for (let order = 0; order < spec.agreements.length; order++) {
    const item = spec.agreements[order]
    const [row] = await trx('agreements').insert({
      title: item.title,
      description: item.description,
      created_at: acceptedAt,
      updated_at: acceptedAt
    }).returning('id')
    const agreementId = idOf(row)
    await trx('groups_agreements').insert({
      group_id: groups.parent.id,
      agreement_id: agreementId,
      active: true,
      order,
      created_at: acceptedAt,
      updated_at: acceptedAt
    })
    for (const person of Object.values(people)) {
      if (person.pending) continue
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
 * Join questions, plus one pending request when the spec names one.
 */
async function insertQuestions (trx, spec, h, groups, people) {
  const questionIds = []
  for (const prompt of spec.questions) {
    const [row] = await trx('questions').insert({ text: prompt.text, created_at: h.daysAgo(50) }).returning('id')
    const questionId = idOf(row)
    questionIds.push(questionId)
    await trx('group_join_questions').insert({
      group_id: groups.parent.id,
      question_id: questionId,
      created_at: h.daysAgo(50),
      updated_at: h.daysAgo(50)
    })
  }
  if (!spec.pendingJoinKey || !people[spec.pendingJoinKey]) return
  const pending = people[spec.pendingJoinKey]
  const [request] = await trx('join_requests').insert({
    user_id: pending.id,
    group_id: groups.parent.id,
    status: 0,
    created_at: h.daysAgo(1),
    updated_at: h.daysAgo(1)
  }).returning('id')
  for (let i = 0; i < spec.questions.length; i++) {
    await trx('group_join_questions_answers').insert({
      question_id: questionIds[i],
      join_request_id: idOf(request),
      answer: spec.questions[i].sampleAnswer || '',
      group_id: groups.parent.id,
      user_id: pending.id,
      created_at: h.daysAgo(1),
      updated_at: h.daysAgo(1)
    })
  }
}

/**
 * Suggested skills on the network, and skills on each profile.
 */
async function insertSkills (trx, spec, groups, people) {
  const skillIds = {}
  for (const name of spec.skillPool || []) skillIds[name] = await findOrCreateSkill(trx, name)
  for (const name of Object.keys(skillIds)) {
    await trx('groups_suggested_skills').insert({
      group_id: groups.parent.id,
      skill_id: skillIds[name],
      created_at: new Date()
    })
  }
  for (const person of Object.values(people)) {
    for (const name of person.skills || []) {
      const skillId = skillIds[name] || await findOrCreateSkill(trx, name)
      skillIds[name] = skillId
      const exists = await trx('skills_users').where({ skill_id: skillId, user_id: person.id, type: 0 }).first()
      if (!exists) await trx('skills_users').insert({ skill_id: skillId, user_id: person.id, type: 0 })
    }
  }
}

/**
 * Topics on the parent group.
 * @returns {Promise<Record<string, number>>}
 */
async function insertTopics (trx, spec, h, groups) {
  const tags = {}
  for (const name of spec.topics) {
    tags[name] = await findOrCreateTag(trx, name)
    await trx('groups_tags').insert({
      group_id: groups.parent.id,
      tag_id: tags[name],
      created_at: h.daysAgo(50),
      updated_at: h.daysAgo(50),
      is_default: name === 'general',
      num_followers: 0
    })
  }
  return tags
}

/**
 * System roles plus the custom roles named in the spec.
 * @returns {Promise<Record<string, number>>}
 */
async function insertRoles (trx, spec, h, groups, people) {
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
  for (const def of spec.roles) {
    roles[def.key] = await insertCustomRole(trx, groups.parent.id, def.name, def.emoji, def.description, def.responsibilities || [], responsibilities)
  }

  const seen = new Set()
  for (const person of Object.values(people)) {
    if (person.pending) continue
    await addMembership(trx, h, groups.parent.id, person, seen, person.realUser ? new Date() : joinDate(h, person, 0))
    for (const spaceKey of person.spaces || []) {
      const space = groups.byKey[spaceKey]
      if (!space) continue
      const extra = {}
      if (spec.unread && person.key === spec.unread.person && spaceKey === spec.unread.space) {
        extra.new_post_count = spec.unread.count || 0
      }
      await addMembership(trx, h, space.id, person, seen, null, extra)
    }
    for (const roleKey of person.roles || []) {
      if (!roles[roleKey]) throw new Error(`Unknown role ${roleKey} on ${person.key}`)
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
async function insertPosts (trx, spec, h, groups, people, tags, marker) {
  const made = {}
  const roster = Object.values(people).filter(person => !person.pending)
  let reactionTotal = 0
  let commentTotal = 0

  for (const post of spec.posts) {
    const author = people[post.by]
    const created = post.hoursAgo ? h.hoursAgo(post.hoursAgo) : h.at(post.at)
    let locationId = null
    const locationText = postLocationText(spec, post)
    if (post.lat != null) {
      locationId = await insertLocation(trx, spec, {
        lat: post.lat,
        lng: post.lng,
        fullText: locationText,
        neighborhood: post.place,
        city: spec.place.usePostCity ? post.city : spec.place.city
      })
    }
    const fulfilledAt = post.fulfilled ? h.at(post.fulfilled.at) : null
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
      location: locationText ? locationText.slice(0, 255) : null,
      location_id: locationId,
      fulfilled_at: fulfilledAt,
      created_from: marker,
      start_time: post.start ? h.at(post.start) : (post.type === 'proposal' ? created : null),
      end_time: post.end ? h.at(post.end) : (post.closes ? h.at(post.closes) : null),
      timezone: post.type === 'event' || post.type === 'proposal' ? spec.tz : null,
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
    if (post.image && spec.images[post.image]) {
      await trx('media').insert({ post_id: postId, type: 'image', url: spec.images[post.image], created_at: created, position: 0 })
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
      for (const option of post.options) {
        const text = option.text != null ? option.text : option[0]
        const emoji = option.emoji != null ? option.emoji : option[1]
        const [createdOption] = await trx('proposal_options').insert({ post_id: postId, text, emoji, color: null }).returning('id')
        optionIds.push(idOf(createdOption))
      }
      let cursor = 0
      const voters = roster.filter(person => person.id !== author.id)
      for (let optionIndex = 0; optionIndex < (post.votes || []).length; optionIndex++) {
        for (let n = 0; n < post.votes[optionIndex]; n++) {
          const voter = voters[cursor % voters.length]
          cursor += 1
          await trx('proposal_votes').insert({ post_id: postId, option_id: optionIds[optionIndex], user_id: voter.id, created_at: created })
        }
      }
    }
    if (post.type === 'event') await insertRsvps(trx, post, postId, author, people, roster, created)

    const authoredCount = (post.comments || []).length
    const comments = [...(post.comments || [])]
    const target = post.commentTarget || comments.length
    let fillerIndex = 0
    while (comments.length < target) {
      const spanishSpaces = spec.fillerSpanishSpaces || []
      const spanish = (post.spaces || []).some(space => spanishSpaces.indexOf(space) !== -1) && fillerIndex % 4 === 0
      const pool = roster.filter(person => person.id !== author.id && (!spanish || person.locale === 'es'))
      const speaker = pool[fillerIndex % pool.length] || roster[fillerIndex % roster.length]
      const lines = spanish ? (spec.filler.es || spec.filler.en) : spec.filler.en
      comments.push({
        by: speaker.key,
        text: lines[fillerIndex % lines.length]
      })
      fillerIndex += 1
    }

    let latest = created
    const commenterIds = new Set()
    for (let i = 0; i < comments.length; i++) {
      const comment = comments[i]
      const when = comment.at ? h.at(comment.at) : new Date(created.getTime() + ((i + 1) / (comments.length + 1)) * (Date.now() - created.getTime() - 3600000))
      if (when > latest) latest = when
      const commenter = people[comment.by]
      const [commentRow] = await trx('comments').insert({
        user_id: commenter.id,
        post_id: postId,
        created_at: when,
        text: rich(comment.text, comment.mention ? people[comment.mention] : null),
        active: true,
        created_from: marker
      }).returning('id')
      const commentId = idOf(commentRow)
      commenterIds.add(commenter.id)
      commentTotal += 1
      if (i < authoredCount) made[`${post.key}:${comment.by}`] = { id: commentId, postId, at: when }
      const added = await addReactions(trx, spec, 'comment', commentId, comment.reactions || 0, roster, commenter.id, i, comment.emoji)
      reactionTotal += added
      await ensureFollower(trx, postId, commenter.id, { following: true, last_read_at: when })
    }

    const postReactions = post.reactions != null ? post.reactions : (post.type === 'submission' ? 2 : 4)
    reactionTotal += await addReactions(trx, spec, 'post', postId, postReactions, roster, author.id, reactionTotal)
    const summary = await reactionSummary(trx, postId)
    await trx('posts').where({ id: postId }).update({
      num_comments: comments.length,
      num_commenters: commenterIds.size,
      num_people_reacts: summary.count,
      reactions_summary: summary.map,
      updated_at: latest
    })
    if (spec.unreadPost && post.key === spec.unreadPost.key) {
      const reader = people[spec.unreadPost.person]
      await trx('posts_users').where({ post_id: postId, user_id: reader.id }).update({
        last_read_at: new Date(latest.getTime() - 3600000)
      })
    }
  }

  if (spec.project && made[spec.project.key]) {
    for (const key of spec.project.children || []) {
      if (!made[key]) continue
      await trx('posts').where({ id: made[key].id }).update({
        parent_post_id: made[spec.project.key].id,
        is_project_request: key.startsWith(spec.project.requestPrefix || 'R')
      })
    }
  }

  made.commentTotal = commentTotal
  made.reactionTotal = reactionTotal
  await topUp(trx, spec, h, made, roster, people, marker)
  return made
}

/**
 * Add comments and reactions until the network feels as dense as the spec asks.
 */
async function topUp (trx, spec, h, made, roster, people, marker) {
  const density = spec.density || {}
  const postKeys = new Set(spec.posts.map(post => post.key))
  const postIds = Object.entries(made).filter(([key, value]) => {
    return postKeys.has(key) && value && value.id && !densitySkip(density, key)
  }).map(([, value]) => value.id)
  if (!postIds.length) return
  let comments = made.commentTotal
  let guard = 0
  const minComments = density.minComments || 0
  while (comments < minComments && guard < 400) {
    const postId = postIds[guard % postIds.length]
    const speaker = roster[guard % roster.length]
    await trx('comments').insert({
      user_id: speaker.id,
      post_id: postId,
      created_at: h.hoursAgo(5 + (guard % 40)),
      text: rich(spec.filler.en[guard % spec.filler.en.length]),
      active: true,
      created_from: marker
    })
    comments += 1
    guard += 1
  }
  let reactions = made.reactionTotal
  guard = 0
  const minReactions = density.minReactions || 0
  while (reactions < minReactions && guard < 800) {
    const postId = postIds[guard % postIds.length]
    const added = await addReactions(trx, spec, 'post', postId, 1, roster, people[realKey(spec)].id, reactions + guard)
    reactions += added
    guard += 1
    if (!added) break
  }
  await refreshPostStats(trx, marker)
}

/**
 * Chat rooms. Remembers a mention of the real user for the notification bell.
 * @returns {Promise<object>}
 */
async function insertChats (trx, spec, h, groups, people, marker) {
  const notes = {}
  let previousId = null
  for (const room of spec.chats || []) {
    const group = room.room === 'parent' ? groups.parent : groups.byKey[room.room]
    for (const message of room.messages || []) {
      const when = message.minutesAgo ? h.minutesAgo(message.minutesAgo) : h.at(message.at)
      const author = people[message.by]
      const [row] = await trx('posts').insert({
        description: rich(message.text, message.mention ? people[message.mention] : null),
        type: 'chat',
        created_at: when,
        updated_at: when,
        user_id: author.id,
        active: true,
        visibility: 0,
        created_from: marker,
        num_comments: 0
      }).returning('id')
      const postId = idOf(row)
      await trx('groups_posts').insert({ post_id: postId, group_id: group.id })
      await ensureFollower(trx, postId, author.id, { following: true, last_read_at: when })
      if (message.image && spec.images[message.image]) {
        await trx('media').insert({ post_id: postId, type: 'image', url: spec.images[message.image], created_at: when, position: 0 })
      }
      if (spec.mention && room.room === spec.mention.space && message.mention === spec.mention.person) {
        notes.mention = { id: postId, at: when, previousId }
      }
      if (spec.mention && room.room === spec.mention.space) previousId = postId
    }
  }
  if (notes.mention && spec.mention && groups.views[`${spec.mention.space}:chat`]) {
    await trx('group_views_users').insert({
      view_id: groups.views[`${spec.mention.space}:chat`],
      user_id: people[spec.mention.person].id,
      new_post_count: spec.mention.unread || 0,
      last_read_post_id: notes.mention.previousId,
      created_at: new Date(),
      updated_at: new Date()
    })
  }
  return notes
}

/**
 * Direct messages.
 */
async function insertThreads (trx, spec, h, people, marker) {
  for (const thread of spec.threads || []) {
    const messages = thread.messages || []
    if (!messages.length) continue
    const last = messages[messages.length - 1]
    const lastAt = last.minutesAgo ? h.minutesAgo(last.minutesAgo) : h.at(last.at)
    const firstAt = messages[0].minutesAgo ? h.minutesAgo(messages[0].minutesAgo) : h.at(messages[0].at)
    const starter = people[messages[0].by]
    const [row] = await trx('posts').insert({
      type: 'thread',
      created_at: firstAt || lastAt,
      updated_at: lastAt,
      user_id: starter.id,
      active: true,
      visibility: 0,
      created_from: marker
    }).returning('id')
    const postId = idOf(row)
    for (const key of thread.people || []) {
      const readAt = thread.unread && key === realKey(spec) ? new Date(lastAt.getTime() - 60000) : lastAt
      await ensureFollower(trx, postId, people[key].id, { following: true, last_read_at: readAt })
    }
    for (const message of messages) {
      const when = message.minutesAgo ? h.minutesAgo(message.minutesAgo) : h.at(message.at)
      await trx('comments').insert({
        user_id: people[message.by].id,
        post_id: postId,
        created_at: when,
        text: rich(message.text),
        active: true,
        created_from: marker
      })
    }
  }
}

/**
 * Token allocations for funders who already voted.
 */
async function insertFunding (trx, spec, groups, people, made, roles) {
  const funding = spec.funding
  await trx('funding_rounds').where({ id: groups.roundId }).update({
    voter_roles: asJson(trx, [{ id: Number(roles[funding.role]) }]),
    num_submissions: funding.grantKeys.length,
    num_participants: await memberCount(trx, groups.byKey[funding.space].id)
  })
  for (const key of Object.keys(funding.allocations || {})) {
    for (let index = 0; index < funding.grantKeys.length; index++) {
      const postId = made[funding.grantKeys[index]].id
      await ensureFollower(trx, postId, people[key].id, {
        following: true,
        tokens_allocated_to: funding.allocations[key][index],
        active: true
      })
    }
    await mergeMembershipSettings(trx, groups.byKey[funding.space].id, people[key].id, { tokensRemaining: 0 })
  }
  for (const [key, remaining] of Object.entries(funding.tokensRemaining || {})) {
    await mergeMembershipSettings(trx, groups.byKey[funding.space].id, people[key].id, { tokensRemaining: remaining })
  }
}

/**
 * Welcome track enrollment.
 */
async function insertTrack (trx, spec, h, groups, people, marker) {
  const track = spec.welcomeTrack
  const viewId = groups.views[track.viewKey]
  if (!viewId) throw new Error('Welcome track is missing its steps view')
  const host = people[track.host]
  const actionIds = []
  for (let index = 0; index < track.actions.length; index++) {
    const action = track.actions[index]
    const created = h.daysAgo(50 - index)
    const [row] = await trx('posts').insert({
      name: action.title,
      description: rich(action.details),
      type: 'action',
      created_at: created,
      updated_at: created,
      user_id: host.id,
      active: true,
      visibility: 0,
      created_from: marker,
      completion_action: action.completion,
      completion_action_settings: asJson(trx, action.settings || {})
    }).returning('id')
    const postId = idOf(row)
    actionIds.push(postId)
    await trx('groups_posts').insert({ post_id: postId, group_id: groups.byKey[track.space].id })
    await trx('collections_posts').insert({
      post_id: postId,
      user_id: host.id,
      view_id: viewId,
      order: index,
      created_at: created,
      updated_at: created
    })
  }

  const enrolled = Object.values(people).filter(person => !person.pending && (person.spaces || []).indexOf(track.space) !== -1)
  const reader = people[realKey(spec)]
  const ordered = [reader].concat(enrolled.filter(person => person.key !== reader.key)).slice(0, track.enrolled || enrolled.length)
  const completed = new Set(ordered.slice(0, track.completed || 0).map(person => person.key))
  let mid = ordered.filter(person => person.supporting && person.recent && !completed.has(person.key)).slice(0, track.midway || 0)
  if (mid.length < (track.midway || 0)) mid = ordered.filter(person => !completed.has(person.key)).slice(0, track.midway || 0)
  const midKeys = new Set(mid.map(person => person.key))

  for (const person of ordered) {
    const doneAll = completed.has(person.key)
    const doneSome = midKeys.has(person.key)
    if (doneAll) {
      await mergeMembershipSettings(trx, groups.byKey[track.space].id, person.id, { completedAt: h.daysAgo(12).toISOString() })
    }
    for (let step = 0; step < actionIds.length; step++) {
      const finished = doneAll || (doneSome && step < 2) || (!doneAll && !doneSome && step === 0)
      if (!finished) continue
      const response = stepResponse(spec, track.actions[step], person)
      await ensureFollower(trx, actionIds[step], person.id, {
        following: true,
        completed_at: h.daysAgo(40 - step),
        completion_response: asJson(trx, response)
      })
      if (track.actions[step].completion === 'comment') {
        await trx('comments').insert({
          user_id: person.id,
          post_id: actionIds[step],
          created_at: h.daysAgo(40 - step),
          text: rich(response[0]),
          active: true,
          created_from: marker
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
 * Unread items in the real user's bell.
 */
async function insertNotifications (trx, spec, h, groups, people, made, chatNotes) {
  const reader = people[realKey(spec)]
  for (const item of spec.bell || []) {
    const row = {
      actor_id: people[item.by].id,
      reader_id: reader.id,
      group_id: item.group === 'parent' || !item.group ? groups.parent.id : groups.byKey[item.group].id,
      created_at: item.daysAgo != null ? h.daysAgo(item.daysAgo) : new Date(),
      meta: { reasons: [item.reason], demo: spec.slug }
    }
    if (item.type === 'comment') {
      const note = made[`${item.post}:${item.by}`]
      if (!note) continue
      row.post_id = note.postId
      row.comment_id = note.id
      row.created_at = note.at
    }
    if (item.type === 'mention') {
      if (!chatNotes.mention) continue
      row.post_id = chatNotes.mention.id
      row.created_at = chatNotes.mention.at
    }
    const [activity] = await trx('activities').insert({ ...row, unread: true, meta: asJson(trx, row.meta) }).returning('id')
    await trx('notifications').insert({
      activity_id: idOf(activity),
      user_id: reader.id,
      medium: 0,
      created_at: row.created_at,
      updated_at: row.created_at,
      sent_at: row.created_at
    })
  }
}

/**
 * Peer link to an existing group, or a small hidden stand-in.
 */
async function insertPeer (trx, spec, h, groups) {
  let peer = await trx('groups').where({ slug: spec.peer.slug, active: true }).first('id')
  if (!peer) {
    const id = await insertGroup(trx, spec, h, {
      name: spec.peer.name,
      slug: spec.peer.standinSlug,
      purpose: spec.peer.purpose,
      description: spec.peer.description || spec.peer.purpose,
      visibility: VISIBILITY.hidden,
      accessibility: ACCESSIBILITY.restricted,
      created_by_id: null,
      settings: { demo: spec.slug, layout: 'two-column' },
      home_route: spec.peer.homeRoute || '/all',
      avatar_url: spec.images.marks[spec.peer.markKey] || null
    })
    peer = { id }
  }
  await trx('group_relationships').insert({
    parent_group_id: groups.parent.id,
    child_group_id: peer.id,
    relationship_type: 1,
    active: true,
    created_at: h.daysAgo(40),
    updated_at: h.daysAgo(40)
  })
}

/**
 * Member counts, and the real user's badge across every unread activity.
 */
async function recount (trx, spec, groups, readerId) {
  const ids = [groups.parent.id].concat(Object.values(groups.byKey).map(group => group.id))
  for (const id of [...new Set(ids)]) {
    const rows = await trx('group_memberships').where({ group_id: id, active: true }).count('* as n')
    await trx('groups').where({ id }).update({ num_members: Number(rows[0].n) })
  }
  await trx.raw(
    `update users set new_notification_count = (
      select count(*) from activities where reader_id = users.id and unread = true
    ) where id = ?`,
    [readerId]
  )
  const demoNotes = await trx('activities').where({ reader_id: readerId, unread: true }).whereRaw("meta->>'demo' = ?", [spec.slug]).count('* as n')
  return Number(demoNotes[0].n)
}

/**
 * Event invitations and RSVPs.
 */
async function insertRsvps (trx, post, postId, author, people, roster, created) {
  const going = new Set(post.going || [])
  const interested = new Set(post.interested || [])
  if (post.goingCount) {
    const preferred = roster.filter(person => (post.spaces || []).some(space => (person.spaces || []).indexOf(space) !== -1))
    for (const person of preferred.concat(roster)) {
      if (going.size >= post.goingCount) break
      if (!interested.has(person.key)) going.add(person.key)
    }
  }
  const responses = new Map()
  going.forEach(key => responses.set(key, 'yes'))
  interested.forEach(key => { if (!responses.has(key)) responses.set(key, 'interested') })
  if (post.inviteTibet && !responses.has(realKeyFromPost(post, people))) responses.set(realKeyFromPost(post, people), null)
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
 * The real user's key, for RSVP invites that name them.
 * @param {object} post
 * @param {Record<string, object>} people
 * @returns {string}
 */
function realKeyFromPost (post, people) {
  const found = Object.values(people).find(person => person.realUser)
  return (found && found.key) || 'tibet'
}

/**
 * Insert a group row and return its id.
 * @returns {Promise<number|string>}
 */
async function insertGroup (trx, spec, h, attrs) {
  const now = new Date()
  const [row] = await trx('groups').insert({
    active: true,
    created_at: attrs.created_at || h.daysAgo(60),
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
    accepted_post_types: attrs.accepted_post_types ? jsonValue(trx, attrs.accepted_post_types) : null,
    geo_shape: attrs.geo ? trx.raw('ST_SetSRID(ST_GeomFromGeoJSON(?), 4326)', [attrs.geo]) : null,
    access_code: crypto.randomBytes(4).toString('hex'),
    calendar_token: crypto.randomUUID(),
    status: attrs.status || 'published'
  }).returning('id')
  return idOf(row)
}

/**
 * Menu views inside one group.
 * @returns {Promise<Record<string, number>>}
 */
async function insertViews (trx, groupId, specs) {
  const ids = {}
  const now = new Date()
  for (let index = 0; index < specs.length; index++) {
    const item = specs[index]
    const [row] = await trx('group_views').insert({
      group_id: groupId,
      type: item.type,
      name: item.name || null,
      icon: item.icon || null,
      order: index,
      page_content: item.page || null,
      linked_group_id: item.linked || null,
      topics: asJson(trx, item.topics || []),
      settings: item.settings ? asJson(trx, item.settings) : null,
      created_at: now,
      updated_at: now
    }).returning('id')
    ids[item.key || item.type] = idOf(row)
  }
  return ids
}

/**
 * Replace space keys on menu items with group ids.
 * @param {object[]} items
 * @param {Record<string, object>} byKey
 * @returns {object[]}
 */
function resolveViews (items, byKey) {
  return items.map(item => ({
    ...item,
    linked: item.space ? byKey[item.space].id : item.linked || null
  }))
}

/**
 * Empty track row.
 * @returns {Promise<number|string>}
 */
async function insertTrackRow (trx, h, groupId, track) {
  const created = h.daysAgo(50)
  const [row] = await trx('tracks').insert({
    group_id: groupId,
    action_descriptor: track.actionDescriptor || 'Step',
    action_descriptor_plural: track.actionDescriptorPlural || 'Steps',
    completion_message: track.completionMessage || '',
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
async function insertRoundRow (trx, spec, h, groupId) {
  const round = spec.funding.round || {}
  const [row] = await trx('funding_rounds').insert({
    group_id: groupId,
    criteria: round.criteria || '',
    require_budget: round.requireBudget !== false,
    voting_method: round.votingMethod || 'token_allocation_constant',
    token_type: round.tokenType || 'Tokens',
    total_tokens: round.totalTokens || 100,
    min_token_allocation: round.minTokenAllocation || 0,
    max_token_allocation: round.maxTokenAllocation || 40,
    submissions_open_at: h.at(round.submissionsOpenAt || [-21, 9, 0]),
    submissions_close_at: h.at(round.submissionsCloseAt || [-7, 18, 0]),
    voting_opens_at: h.at(round.votingOpensAt || [-2, 9, 0]),
    voting_closes_at: h.at(round.votingClosesAt || [5, 18, 0]),
    allow_self_voting: !!round.allowSelfVoting,
    show_realtime_votes: round.showRealtimeVotes !== false,
    show_realtime_submissions: !!round.showRealtimeSubmissions,
    submitter_roles: asJson(trx, []),
    voter_roles: asJson(trx, []),
    created_at: h.at(round.createdAt || [-24, 10, 0]),
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
 * One active membership. Demo accounts do not receive email or push.
 */
async function addMembership (trx, h, groupId, person, seen, createdAt, extraColumns = {}) {
  const key = `${groupId}:${person.id}`
  if (seen.has(key)) return
  seen.add(key)
  const when = createdAt || joinDate(h, person, seen.size)
  await trx('group_memberships').insert({
    group_id: groupId,
    user_id: person.id,
    active: true,
    created_at: when,
    updated_at: when,
    new_post_count: extraColumns.new_post_count || 0,
    settings: asJson(trx, {
      lastReadAt: person.realUser ? new Date().toISOString() : when.toISOString(),
      showJoinForm: false,
      joinQuestionsAnsweredAt: when.toISOString(),
      agreementsAcceptedAt: when.toISOString(),
      sendEmail: !!person.realUser,
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
 * Reactions for one post or comment.
 * @returns {Promise<number>}
 */
async function addReactions (trx, spec, entityType, entityId, count, roster, authorId, salt, onlyEmoji) {
  if (!count) return 0
  const existing = new Set(
    (await trx('reactions').where({ entity_type: entityType, entity_id: entityId }).pluck('user_id')).map(String)
  )
  let added = 0
  const emojis = spec.emojis
  for (let n = 0; n < roster.length && added < count; n++) {
    const person = roster[(salt + n) % roster.length]
    if (String(person.id) === String(authorId)) continue
    if (existing.has(String(person.id))) continue
    const emoji = onlyEmoji ? emojis.find(item => item.full === onlyEmoji) || emojis[0] : emojis[(salt + n) % emojis.length]
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
function stepResponse (spec, action, person) {
  const neighborhood = spec.neighborhoods[person.neighborhood] || {}
  if (action.completion === 'selectOne') return [neighborhood.option || 'None yet']
  if (action.completion === 'text' || action.completion === 'comment') {
    const placeName = neighborhood.label || spec.place.city || spec.name
    return [`${person.name.split(' ')[0]} in ${placeName}. ${person.tagline || 'Glad to be here.'}`]
  }
  return ['done']
}

/**
 * Parent group settings. Hidden from search unless the spec says otherwise.
 * @param {Date} now
 * @returns {object}
 */
function parentSettings (spec, h, now) {
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
    agreements_last_updated_at: h.daysAgo(50).toISOString(),
    demo: spec.slug,
    seededAt: now.toISOString()
  }
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
async function insertLocation (trx, spec, { lat, lng, fullText, neighborhood, city }) {
  const now = new Date()
  const [row] = await trx('locations').insert({
    center: trx.raw('ST_SetSRID(ST_MakePoint(?, ?), 4326)', [lng, lat]),
    full_text: String(fullText).slice(0, 255),
    city: city || spec.place.city || spec.place.fallbackCity,
    region: spec.place.region,
    country: spec.place.country || 'United States',
    country_code: spec.place.countryCode || 'US',
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
function joinDate (h, member, index) {
  if (member.pending) return h.daysAgo(1)
  if (member.supporting && member.recent) return h.daysAgo(5 + (index % 160))
  if (member.supporting) return h.daysAgo(200 + (index % 400))
  return h.daysAgo(80 + (index % 200))
}

/**
 * @param {object} density
 * @param {string} key
 * @returns {boolean}
 */
function densitySkip (density, key) {
  if ((density.skipPostKeys || []).indexOf(key) !== -1) return true
  return (density.skipPrefixes || []).some(prefix => key.startsWith(prefix))
}

/**
 * Display string for a located post.
 * @param {object} post
 * @returns {string|null}
 */
function postLocationText (spec, post) {
  if (!post.place) return null
  if (spec.place.usePostCity) return `${post.place}, ${post.city}, ${spec.place.region}`
  return `${post.place}, ${spec.place.postSuffix}`
}

/**
 * @param {object} spec
 * @returns {string}
 */
function realKey (spec) {
  const person = spec.people.find(item => item.realUser)
  return person ? person.key : null
}

/**
 * @param {string} name
 * @returns {number}
 */
function visibilityOf (name) {
  const value = VISIBILITY[name || 'hidden']
  if (value == null) throw new Error(`Unknown visibility ${name}`)
  return value
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
  let safe = esc(text || '')
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
 * Bind a JS value as jsonb.
 * @returns {import('knex').Knex.Raw}
 */
function asJson (trx, value) {
  return trx.raw('?::jsonb', [JSON.stringify(value == null ? {} : value)])
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
async function refreshPostStats (trx, marker) {
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
  `, [marker])
  const ids = await trx('posts').where({ created_from: marker }).whereNotIn('type', ['chat', 'thread', 'action']).pluck('id')
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
 * Clock helpers bound to the spec's timezone.
 * @param {object} spec
 * @returns {object}
 */
function clock (spec) {
  const zone = spec.tz
  return {
    at (value) {
      const [day, hour, minute] = value
      return DateTime.now().setZone(zone).startOf('day').plus({ days: day, hours: hour, minutes: minute || 0 }).toJSDate()
    },
    daysAgo (days) {
      return DateTime.now().setZone(zone).startOf('day').minus({ days }).plus({ hours: 10 }).toJSDate()
    },
    hoursAgo (hours) {
      return DateTime.now().setZone(zone).minus({ hours }).toJSDate()
    },
    minutesAgo (minutes) {
      return DateTime.now().setZone(zone).minus({ minutes }).toJSDate()
    }
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

/**
 * Public origin for invite links printed by the CLI.
 * @returns {string}
 */
function appBase () {
  const domain = process.env.DOMAIN
  if (!domain) return 'http://localhost:3000'
  if (/^https?:\/\//.test(domain)) return domain.replace(/\/$/, '')
  return `http://${domain}`
}

module.exports = { buildDemo, relationKind, refreshSearch, appBase }
