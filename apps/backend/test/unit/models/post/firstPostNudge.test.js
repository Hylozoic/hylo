/* eslint-disable no-unused-expressions */
import setup from '../../../setup'
import factories from '../../../setup/factories'
import { runDaily, stillUnanswered, unansweredFirstPosts } from '../../../../api/models/post/firstPostNudge'
import { FIRST_POST_NUDGE } from '../../../../lib/experiments'

const HOUR = 60 * 60 * 1000
const DAY = 24 * HOUR

async function assignSystemRole (user, group, name) {
  const role = await GroupRole.findSystemRole(group.id, name)
  return MemberGroupRole.forge({ user_id: user.id, group_id: group.id, group_role_id: role.id, active: true }).save()
}

// Stores the newcomer's experiment arm, which assign() then keeps
function putInArm (user, variant) {
  return bookshelf.knex('experiment_assignments').insert({
    experiment: FIRST_POST_NUDGE.name,
    subject_type: FIRST_POST_NUDGE.subjectType,
    subject_id: user.id,
    variant
  })
}

async function newcomer (group, { joinedDaysAgo = 2, variant = 'nudge' } = {}) {
  const user = await factories.user().save()
  await user.joinGroup(group)
  await bookshelf.knex('group_memberships').where({ user_id: user.id, group_id: group.id })
    .update({ created_at: new Date(Date.now() - joinedDaysAgo * DAY) })
  await putInArm(user, variant)
  return user
}

async function postBy (user, group, { hoursAgo = 30, type = 'discussion' } = {}) {
  const post = await factories.post({ user_id: user.id, type, created_at: new Date(Date.now() - hoursAgo * HOUR) }).save()
  await bookshelf.knex('groups_posts').insert({ post_id: post.id, group_id: group.id })
  return post
}

async function nudgesFor (readerId, postId) {
  const activities = await Activity.query(q => {
    q.where({ reader_id: readerId, post_id: postId })
    q.whereRaw("meta->'reasons' \\? 'firstPostUnanswered'")
  }).fetchAll({ withRelated: 'notifications' })
  return activities.models.map(activity => activity.related('notifications').map(n => n.get('medium')))
}

describe('post/firstPostNudge (D49 experiment)', () => {
  let group, administrator, moderator, host, member

  before(async () => {
    await setup.clearDb()
    group = await factories.group().save()
    administrator = await factories.user().save()
    moderator = await factories.user().save()
    host = await factories.user().save()
    member = await factories.user().save()
    await administrator.joinGroup(group, { assignAdministrator: true })
    for (const person of [moderator, host, member]) await person.joinGroup(group)
    await assignSystemRole(moderator, group, 'Moderator')
    await assignSystemRole(host, group, 'Host')
  })

  after(() => setup.clearDb())

  const found = async () => (await unansweredFirstPosts()).map(row => row.postId)

  it('finds a newcomer\'s first feed post between 24 and 48 hours old with no response', async () => {
    const author = await newcomer(group)
    const due = await postBy(author, group, { hoursAgo: 30 })
    const tooNew = await postBy(await newcomer(group), group, { hoursAgo: 10 })
    const tooOld = await postBy(await newcomer(group), group, { hoursAgo: 60 })
    const chat = await postBy(await newcomer(group), group, { hoursAgo: 30, type: 'chat' })

    const posts = await found()
    expect(posts).to.include(String(due.id))
    expect(posts).to.not.include.members([tooNew.id, tooOld.id, chat.id].map(String))
  })

  it('skips posts that already had a comment or a reaction from someone else', async () => {
    const commented = await postBy(await newcomer(group), group)
    await factories.comment({ post_id: commented.id, user_id: member.id }).save()
    const reacted = await postBy(await newcomer(group), group)
    await bookshelf.knex('reactions').insert({ user_id: host.id, entity_id: reacted.id, entity_type: 'post', emoji_full: '👍', date_reacted: new Date() })
    const ownComment = await postBy(await newcomer(group), group)
    await factories.comment({ post_id: ownComment.id, user_id: ownComment.get('user_id') }).save()

    const posts = await found()
    expect(posts).to.not.include.members([commented.id, reacted.id].map(String))
    expect(posts).to.include(String(ownComment.id))
  })

  it('skips second posts and members who joined long ago', async () => {
    const author = await newcomer(group)
    await postBy(author, group, { hoursAgo: 40 })
    const second = await postBy(author, group, { hoursAgo: 30 })
    const oldTimer = await newcomer(group, { joinedDaysAgo: 90 })
    const oldTimersPost = await postBy(oldTimer, group)

    expect(await found()).to.not.include.members([second.id, oldTimersPost.id].map(String))
  })

  it('nudges Administrators, Moderators and Hosts in-app, once per post, and records it', async () => {
    await bookshelf.knex('first_post_nudges').del()
    const author = await newcomer(group, { variant: 'nudge' })
    const post = await postBy(author, group)
    const controlAuthor = await newcomer(group, { variant: 'control' })
    const controlPost = await postBy(controlAuthor, group)

    const result = await runDaily()
    expect(result.nudged).to.be.at.least(1)
    expect(result.control).to.be.at.least(1)

    for (const steward of [administrator, moderator, host]) {
      expect(await nudgesFor(steward.id, post.id)).to.deep.equal([[Notification.MEDIUM.InApp]])
    }
    expect(await nudgesFor(member.id, post.id)).to.be.empty
    expect(await nudgesFor(author.id, post.id)).to.be.empty

    const row = await bookshelf.knex('first_post_nudges').where({ post_id: post.id, group_id: group.id }).first()
    expect(row.variant).to.equal('nudge')
    expect(row.nudged_at).to.exist

    // The control arm is recorded for the analysis but nobody is nudged
    const controlRow = await bookshelf.knex('first_post_nudges').where({ post_id: controlPost.id }).first()
    expect(controlRow.variant).to.equal('control')
    expect(controlRow.nudged_at).to.equal(null)
    for (const steward of [administrator, moderator, host]) {
      expect(await nudgesFor(steward.id, controlPost.id)).to.be.empty
    }

    // A second run the same day nudges nobody again
    await runDaily()
    expect(await nudgesFor(host.id, post.id)).to.have.length(1)
  })

  it('lists nudged posts that still have no response for the weekly steward email', async () => {
    const since = new Date(Date.now() - 7 * DAY)
    const listed = (await stillUnanswered([group.id], { since })).map(row => row.postId)
    const nudgedRows = await bookshelf.knex('first_post_nudges').where({ group_id: group.id, variant: 'nudge' }).pluck('post_id')
    expect(listed).to.have.members(nudgedRows.map(String))

    const [answered] = nudgedRows
    await factories.comment({ post_id: answered, user_id: host.id }).save()
    expect((await stillUnanswered([group.id], { since })).map(row => row.postId)).to.not.include(String(answered))
  })
})
