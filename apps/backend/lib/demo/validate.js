/**
 * Schema plus reference checks. A spec that passes can be built.
 */
const { validateDemoSchema } = require('../../demos/schema')
const { DEMO_EMAIL_DOMAIN } = require('./addresses')

/**
 * @param {object} spec
 * @returns {string[]}
 */
function validateDemoSpec (spec) {
  const errors = validateDemoSchema(spec)
  if (!spec || typeof spec !== 'object' || !Array.isArray(spec.people) || !Array.isArray(spec.posts)) {
    return errors
  }

  const people = new Set()
  const emails = new Set()
  let realUsers = 0
  for (const person of spec.people) {
    if (!person || !person.key) {
      errors.push('a person is missing a key')
      continue
    }
    if (people.has(person.key)) errors.push(`duplicate person ${person.key}`)
    people.add(person.key)
    if (!person.email) errors.push(`${person.key} is missing an email`)
    else if (emails.has(person.email.toLowerCase())) errors.push(`duplicate email ${person.email}`)
    else emails.add(person.email.toLowerCase())
    if (person.realUser) {
      realUsers += 1
      if (person.email && person.email.toLowerCase() !== String(spec.realUserEmail || '').toLowerCase()) {
        errors.push(`${person.key} is the real user but the email does not match realUserEmail`)
      }
    } else if (person.email && !person.email.toLowerCase().endsWith('@' + DEMO_EMAIL_DOMAIN)) {
      errors.push(`${person.key} must use @${DEMO_EMAIL_DOMAIN}`)
    }
    if (!person.realUser && !isUrl(person.portraitUrl)) {
      errors.push(`${person.key} is missing a portrait URL`)
    }
    if (!person.neighborhood || !spec.centers || !spec.centers[person.neighborhood]) {
      errors.push(`${person.key} has no map center for neighborhood ${person.neighborhood}`)
    }
    if (person.spaces && !Array.isArray(person.spaces)) {
      errors.push(`${person.key} spaces must be an array`)
    }
  }
  if (realUsers !== 1) errors.push(`expected one real user, found ${realUsers}`)

  const spaces = new Set((spec.spaces || []).map(space => space && space.key).filter(Boolean))
  for (const space of spec.spaces || []) {
    if (!space.key) {
      errors.push('a space is missing a key')
      continue
    }
    if (!space.host || !people.has(space.host)) errors.push(`space ${space.key} host ${space.host} is not in the cast`)
    if (!Array.isArray(space.views)) errors.push(`space ${space.key} views must be an array`)
    const markKey = space.markKey || space.key
    if (!isUrl(spec.images && spec.images.marks && spec.images.marks[markKey])) {
      errors.push(`space ${space.key} is missing a mark URL`)
    }
    if (space.bannerKey && !isUrl(spec.images && spec.images[space.bannerKey])) {
      errors.push(`space ${space.key} banner ${space.bannerKey} is missing a URL`)
    }
  }

  const group = spec.group || {}
  if (group.markKey && !isUrl(spec.images && spec.images.marks && spec.images.marks[group.markKey])) {
    errors.push(`group mark ${group.markKey} is missing a URL`)
  }
  if (group.bannerKey && !isUrl(spec.images && spec.images[group.bannerKey])) {
    errors.push(`group banner ${group.bannerKey} is missing a URL`)
  }
  for (const item of group.menu || []) {
    if (item.space && !spaces.has(item.space)) errors.push(`menu item links to unknown space ${item.space}`)
  }

  const postKeys = new Set()
  for (const post of spec.posts) {
    if (!post || !post.key) {
      errors.push('a post is missing a key')
      continue
    }
    if (postKeys.has(post.key)) errors.push(`duplicate post ${post.key}`)
    postKeys.add(post.key)
    checkPerson(errors, people, post.by, `post ${post.key} author`)
    checkSpaces(errors, spaces, post.spaces, `post ${post.key}`)
    if (post.mention) checkPerson(errors, people, post.mention, `post ${post.key} mention`)
    if (post.image && !isUrl(spec.images && spec.images[post.image])) {
      errors.push(`post ${post.key} image ${post.image} is missing a URL`)
    }
    for (const key of ['going', 'interested', 'members']) {
      for (const personKey of post[key] || []) checkPerson(errors, people, personKey, `post ${post.key} ${key}`)
    }
    if (post.fulfilled) {
      for (const personKey of post.fulfilled.by || []) checkPerson(errors, people, personKey, `post ${post.key} fulfilled`)
    }
    for (const comment of post.comments || []) {
      checkPerson(errors, people, comment.by, `post ${post.key} comment`)
      if (comment.mention) checkPerson(errors, people, comment.mention, `post ${post.key} comment mention`)
    }
  }

  for (const room of spec.chats || []) {
    if (room.room !== 'parent' && !spaces.has(room.room)) errors.push(`chat room ${room.room} is not a space`)
    for (const message of room.messages || []) {
      checkPerson(errors, people, message.by, `chat ${room.room}`)
      if (message.mention) checkPerson(errors, people, message.mention, `chat ${room.room} mention`)
      if (message.image && !isUrl(spec.images && spec.images[message.image])) {
        errors.push(`chat ${room.room} image ${message.image} is missing a URL`)
      }
    }
  }

  for (const thread of spec.threads || []) {
    for (const personKey of thread.people || []) checkPerson(errors, people, personKey, 'thread')
    for (const message of thread.messages || []) checkPerson(errors, people, message.by, 'thread message')
  }

  if (spec.funding) {
    const grantKeys = spec.funding.grantKeys || []
    grantKeys.forEach(key => {
      if (!postKeys.has(key)) errors.push(`grant ${key} is not a post`)
    })
    const rows = Object.entries(spec.funding.allocations || {})
    const max = (spec.funding.round && spec.funding.round.maxTokenAllocation) || 40
    const each = spec.funding.tokensEach == null ? 100 : spec.funding.tokensEach
    rows.forEach(([personKey, row]) => {
      checkPerson(errors, people, personKey, 'allocation')
      if (!Array.isArray(row) || row.length !== grantKeys.length) {
        errors.push(`allocation for ${personKey} does not match the grant columns`)
        return
      }
      const sum = row.reduce((total, n) => total + n, 0)
      if (sum !== each) errors.push(`allocation for ${personKey} sums to ${sum}, expected ${each}`)
      if (row.some(n => n > max)) errors.push(`allocation for ${personKey} exceeds ${max}`)
    })
    ;(spec.funding.columnTotals || []).forEach((want, index) => {
      const got = rows.reduce((total, [, row]) => total + (row[index] || 0), 0)
      if (got !== want) errors.push(`grant column ${index} sums to ${got}, expected ${want}`)
    })
    if (spec.funding.space && !spaces.has(spec.funding.space)) {
      errors.push(`funding space ${spec.funding.space} does not exist`)
    }
  }

  if (spec.welcomeTrack) {
    if (!spaces.has(spec.welcomeTrack.space)) errors.push('welcome track space does not exist')
    checkPerson(errors, people, spec.welcomeTrack.host, 'welcome track host')
    if (!Array.isArray(spec.welcomeTrack.actions) || !spec.welcomeTrack.actions.length) {
      errors.push('welcome track needs actions')
    }
  }

  if (spec.peer) {
    if (!spec.peer.slug || !spec.peer.standinSlug || !spec.peer.name) {
      errors.push('peer needs slug, standinSlug, and name')
    }
    if (spec.peer.markKey && !isUrl(spec.images && spec.images.marks && spec.images.marks[spec.peer.markKey])) {
      errors.push(`peer mark ${spec.peer.markKey} is missing a URL`)
    }
  }

  if (spec.mention) {
    if (!spaces.has(spec.mention.space)) errors.push(`mention space ${spec.mention.space} does not exist`)
    checkPerson(errors, people, spec.mention.person, 'mention person')
  }
  if (spec.project) {
    if (!postKeys.has(spec.project.key)) errors.push(`project ${spec.project.key} is not a post`)
    ;(spec.project.children || []).forEach(key => {
      if (!postKeys.has(key)) errors.push(`project child ${key} is not a post`)
    })
  }
  ;(spec.bell || []).forEach(item => {
    if (item.by) checkPerson(errors, people, item.by, 'notification')
    if (item.post && !postKeys.has(item.post)) errors.push(`notification post ${item.post} does not exist`)
    if (item.group && item.group !== 'parent' && !spaces.has(item.group)) {
      errors.push(`notification group ${item.group} does not exist`)
    }
  })
  if (spec.pendingJoinKey && !people.has(spec.pendingJoinKey)) {
    errors.push(`pending join user ${spec.pendingJoinKey} is not in the cast`)
  }

  return errors
}

/**
 * @param {string[]} errors
 * @param {Set<string>} people
 * @param {string} key
 * @param {string} where
 */
function checkPerson (errors, people, key, where) {
  if (!key || !people.has(key)) errors.push(`${where} references unknown person ${key}`)
}

/**
 * Posts must name spaces as an array. A string is split into letters and matches nothing.
 * @param {string[]} errors
 * @param {Set<string>} spaces
 * @param {string[]} value
 * @param {string} where
 */
function checkSpaces (errors, spaces, value, where) {
  if (value == null) return
  if (!Array.isArray(value)) {
    errors.push(`${where} spaces must be an array`)
    return
  }
  value.forEach(key => {
    if (!spaces.has(key)) errors.push(`${where} references unknown space ${key}`)
  })
}

/**
 * @param {string} value
 * @returns {boolean}
 */
function isUrl (value) {
  return typeof value === 'string' && /^https?:\/\//.test(value)
}

module.exports = { validateDemoSpec }
