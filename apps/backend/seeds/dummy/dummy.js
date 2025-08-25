/* eslint-disable camelcase */

const bcrypt = require('bcrypt')
const { faker } = require('@faker-js/faker')
const promisify = require('bluebird').promisify
const hash = promisify(bcrypt.hash, bcrypt)
const readline = require('readline')
const { URL } = require('url')

const n = {
  groups: 50,
  posts: 5000,
  tags: 20,
  users: 1000,
  threads: 100
}

// Add your test account details here. You'll be randomly assigned to a group,
// and you'll also be added to the one specified below.
// (You can create your own later if you want).
const name = 'Test Account'
const email = 'test@hylo.com'
const password = 'hylo'
const group = 'Test Group'
const groupSlug = 'test'
let provider_user_id = ''

function warning (knex) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  })

  return new Promise((resolve, reject) => {
    const connection = knex && knex.client && knex.client.config && knex.client.config.connection
    let dbName = '(unknown)'
    if (connection) {
      if (typeof connection === 'string') {
        try {
          const parsed = new URL(connection)
          dbName = (parsed.pathname || '').replace(/^\//, '')
        } catch (e) {}
      } else if (connection.database) {
        dbName = connection.database
      }
    }
    rl.question(`
      WARNING: Running the dummy seed will COMPLETELY WIPE anything you cared about
      in the database "${dbName}". If you're sure that's what you want, type 'yes'. Anything else
      will result in this script terminating.

    `, answer => {
      if (answer !== 'yes') {
        console.log('Exiting.')
        process.exit()
      }
      console.log('\nOk, you asked for it...\n')
      rl.close()
      return resolve()
    })
  })
}

exports.seed = (knex) => warning(knex)
  .then(() => truncateAll(knex))
  .then(() => seed('users', knex))
  .then(() => hash(password, 10))
  .then(hash => { provider_user_id = hash })
  .then(() => knex('users')
    .insert({
      name,
      email,
      active: true,
      avatar_url: `https://api.dicebear.com/9.x/pixel-art/svg?seed=${faker.random.word()}`,
      email_validated: true,
      created_at: knex.fn.now()
    })
    .returning('id'))
  .then(([user_id]) => {
    return knex('linked_account')
      .insert({
        user_id,
        provider_user_id,
        provider_key: 'password'
      })
  })
  .then(() => knex('tags').insert([
    { name: 'general' },
    { name: 'collaboration' },
    { name: 'regeneration' }
  ]))
  .then(() => knex('responsibilities').insert([
    { title: 'Administration', type: 'system' },
    { title: 'Add Members', type: 'system' },
    { title: 'Remove Members', type: 'system' },
    { title: 'Manage Content', type: 'system' },
    { title: 'Manage Tracks', type: 'system' }
  ]))
  .then(() => knex('common_roles').insert([
    { name: 'Coordinator' },
    { name: 'Moderator' }
  ]))
  .then(() => Promise.all([
    knex('responsibilities').where('title', 'Administration').first('id'),
    knex('responsibilities').where('title', 'Add Members').first('id'),
    knex('responsibilities').where('title', 'Remove Members').first('id'),
    knex('responsibilities').where('title', 'Manage Content').first('id'),
    knex('responsibilities').where('title', 'Manage Tracks').first('id'),
    knex('common_roles').where('name', 'Coordinator').first('id'),
    knex('common_roles').where('name', 'Moderator').first('id')
  ]))
  .then(([admin, addMembers, removeMembers, manageContent, manageTracks, coordinator, moderator]) => knex('common_roles_responsibilities').insert([
    { common_role_id: coordinator.id, responsibility_id: admin.id },
    { common_role_id: coordinator.id, responsibility_id: addMembers.id },
    { common_role_id: coordinator.id, responsibility_id: removeMembers.id },
    { common_role_id: coordinator.id, responsibility_id: manageContent.id },
    { common_role_id: coordinator.id, responsibility_id: manageTracks.id },
    { common_role_id: moderator.id, responsibility_id: manageContent.id }
  ]))
  .then(() => seed('tags', knex))
  .then(() => knex('groups').insert(fakeGroupData('starter-posts', 'starter-posts')))
  .then(() => knex('groups').insert(fakeGroupData(group, groupSlug)))
  .then(() => seed('groups', knex))
  .then(() => seed('posts', knex))
  .then(() => Promise.all([
    knex('users').where('email', email).first('id'),
    knex('groups').where('slug', groupSlug).first('id'),
    knex('tags').where('name', 'general').first('id'),
    knex('tags').where('name', 'regeneration').first('id')
  ]))
  .then(async ([user, group, general, regeneration]) => {
    // Add main user to group
    await knex('group_memberships').insert({
      active: true,
      user_id: user.id,
      group_id: group.id,
      created_at: knex.fn.now(),
      role: 1,
      settings: '{ "send_email": true, "send_push_notifications": true }'
    })

    // Add chat rooms to main group
    const homeWidget = await knex('context_widgets').insert({
      group_id: group.id,
      type: 'home',
      title: 'widget-home',
      order: 1
    })
    await knex('context_widgets').insert({
      type: 'viewChat',
      view_chat_id: general.id,
      group_id: group.id,
      parent_id: homeWidget.id,
      order: 1
    })
    await knex('context_widgets').insert({
      type: 'viewChat',
      view_chat_id: regeneration.id,
      group_id: group.id,
      order: 2
    })
  })
  .then(() => addUsersToGroups(knex))
  .then(() => createThreads(knex))
  .then(() => seedMessages(knex))
  .then(() => addPostsToGroups(knex))
  .catch(err => {
    let report = err.message
    if (err.message.includes('unique constraint')) {
      report =
`
  Error during seeding.

  This isn't uncommon: Faker generates a limited number of unique names,
  and sometimes they collide. You should be able to simply re-run the
  seed until it passes (sometimes four or five tries are required).

${err.message}
`
    }
    console.error(report)
  })

function truncateAll (knex) {
  return knex.raw('TRUNCATE TABLE users CASCADE')
    .then(() => knex.raw('TRUNCATE TABLE tags CASCADE'))
}

const fakeLookup = {
  groups: fakeGroup,
  posts: fakePost,
  tags: fakeTag,
  users: fakeUser
}

function randomIndex (length) {
  return Math.floor(Math.random() * length)
}

function moderatorOrMember () {
  // Role 1 is moderator
  return Math.random() > 0.9 ? 1 : 0
}

function addUsersToGroups (knex) {
  console.info('  --> group_memberships')
  return knex('users').select('id')
    .then(users => Promise.all(users.map(({ id }) => fakeMembership(id, knex))))
}

async function addPostsToGroups (knex) {
  console.info('  --> groups_posts')
  const posts = await knex('posts')
    .select(['id as post_id', 'user_id'])
    .where('type', '!=', 'thread')

  await Promise.all(
    posts.map(({ post_id, user_id }) => knex('group_memberships')
      .where('group_memberships.user_id', user_id)
      .first('group_id')
      .then(({ group_id }) => knex('groups_posts')
        .insert({ post_id, group_id }))
    )
  )

  const [general, regeneration] = await knex('tags').whereIn('name', ['general', 'regeneration']).select('id')

  await Promise.all(
    posts.map(({ post_id }) => knex('posts_tags').insert({ post_id, tag_id: randomIndex(2) === 0 ? general.id : regeneration.id }))
  )
}

function seed (entity, knex, fake = fakeLookup, iterations = n) { // Default to the fakeLookup and n in this file, if none is passed in
  console.info(`  --> ${entity}`)
  return Promise.all(
    [...new Array(iterations[entity])].map(
      () => fake[entity](knex).then(row => knex(entity).insert(row))
    )
  )
}

function createThreads (knex) {
  console.info('  --> threads')
  return knex('groups').where('slug', groupSlug).first('id')
    .then(group => Promise.all(
      [...new Array(n.threads)].map(() => fakeThread(group.id, knex))
    ))
}

function seedMessages (knex) {
  console.info('  --> messages')
  return knex('follows')
    .join('posts', 'posts.id', 'follows.post_id')
    .select('follows.post_id as post', 'follows.user_id as user')
    .where('posts.type', 'thread')
    .then(follows => {
      const created = faker.date.past()
      return Promise.all(
        // Add five messages to each followed thread
        [...follows, ...follows, ...follows, ...follows, ...follows]
          .map(follow => {
            created.setHours(created.getHours() + 1)
            return knex('comments')
              .insert({
                text: faker.lorem.paragraph(),
                post_id: follow.post,
                user_id: follow.user,
                created_at: created.toUTCString(),
                active: true
              })
          })
      )
    })
}

// Grab random row or rows from table
function sample (entity, where, knex, limit = 1) {
  return knex(entity)
    .where(where)
    .select()
    .orderByRaw('random()')
    .limit(limit)
}

function fakeThread (groupId, knex) {
  const whereInGroup = knex.raw(`
    users.id IN (
      SELECT user_id FROM group_memberships
      WHERE group_id = ${groupId}
    )
  `)

  const randomUsers = sample('users', whereInGroup, knex, randomIndex(5) + 2)
  return randomUsers
    .then(users => knex('posts')
      .insert({
        created_at: faker.date.past(),
        type: 'thread',
        user_id: users[0].id,
        active: true
      })
      .returning(['id', 'user_id']))
    .then(([post]) =>
      knex('follows').insert({
        post_id: post.id,
        user_id: post.user_id,
        added_at: faker.date.past()
      })
        .returning('user_id')
    )
}

function fakeGroupData (name, slug, created_by_id, type) {
  return {
    name,
    group_data_type: 1,
    avatar_url: `https://api.dicebear.com/9.x/glass/svg?seed=${faker.random.word()}`,
    access_code: faker.datatype.uuid(),
    description: faker.lorem.paragraph(),
    slug,
    banner_url: 'https://d3ngex8q79bk55.cloudfront.net/misc/default_community_banner.jpg',
    created_at: faker.date.past(),
    created_by_id,
    location: faker.address.country(),
    visibility: 1,
    accessibility: 1,
    settings: { allow_group_invites: false, public_member_directory: false },
    slack_hook_url: faker.internet.url(),
    slack_team: faker.internet.url(),
    slack_configure_url: faker.internet.url(),
    type: type || null
  }
}

function fakeGroup (knex) {
  const name = faker.random.words()

  return Promise.all([
    sample('users', true, knex)
  ]).then(([users]) => fakeGroupData(name, faker.helpers.slugify(name).toLowerCase(), users[0].id))
}

function fakeMembership (user_id, knex) {
  return sample('groups', true, knex)
    .then(([group]) => knex('group_memberships')
      .insert({
        active: true,
        group_id: group.id,
        created_at: knex.fn.now(),
        role: moderatorOrMember(),
        settings: '{ "send_email": true, "send_push_notifications": true }',
        user_id
      }))
}

function fakePost (knex) {
  const type = randomIndex(2) === 0 ? 'discussion' : 'chat'

  return sample('users', true, knex)
    .then(([user]) => ({
      name: type === 'discussion' ? faker.lorem.sentence() : null,
      description: faker.lorem.paragraph(),
      created_at: faker.date.past(),
      user_id: user.id,
      active: true,
      type
    }))
}

function fakeTag () {
  const past = faker.date.past()

  return Promise.resolve({
    name: faker.random.word().split(' ')[0].toLowerCase(),
    created_at: past,
    updated_at: past
  })
}

function fakeUser (maybeEmail) {
  const email = typeof maybeEmail === 'string' ? maybeEmail : null
  return Promise.resolve({
    email: email || faker.internet.email(),
    name: `${faker.name.firstName()} ${faker.name.lastName()}`,
    avatar_url: `https://api.dicebear.com/9.x/pixel-art/svg?seed=${faker.random.word()}`,
    first_name: faker.name.firstName(),
    last_name: faker.name.lastName(),
    last_login_at: faker.date.past(),
    active: true,
    email_validated: true,
    created_at: faker.date.past(),
    bio: faker.lorem.paragraph(),
    banner_url: faker.image.imageUrl(),
    twitter_name: faker.internet.userName(),
    linkedin_url: faker.internet.url(),
    facebook_url: faker.internet.url(),
    work: faker.lorem.paragraph(),
    intention: faker.lorem.paragraph(),
    extra_info: faker.lorem.paragraph(),
    updated_at: faker.date.past(),
    location: faker.address.country(),
    url: faker.internet.url()
  })
}
