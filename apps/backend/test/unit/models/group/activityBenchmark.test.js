/* eslint-disable no-unused-expressions */
import setup from '../../../setup'
import factories from '../../../setup/factories'
import RedisClient from '../../../../api/services/RedisClient'
import {
  QUIET_LINE_DEFAULT,
  QUIET_LINE_REDIS_KEY,
  markGroups,
  quietLine,
  recalculateQuietLine,
  runDaily
} from '../../../../api/models/group/activityBenchmark'

const daysAgo = days => new Date(Date.now() - days * 24 * 60 * 60000)

describe('activityBenchmark', () => {
  let author

  const postIn = async (group, { type = 'discussion', createdAt = daysAgo(1), userId } = {}) => {
    const post = await factories.post({ type, created_at: createdAt, user_id: userId || author.id }).save()
    await post.groups().attach(group.id)
    return post
  }
  const postsIn = async (group, count, opts) => {
    for (let i = 0; i < count; i++) await postIn(group, opts)
  }
  const settingsOf = async group => (await Group.find(group.id)).get('settings')
  const redis = () => RedisClient.create()

  beforeEach(async () => {
    await setup.clearDb()
    await redis().del(QUIET_LINE_REDIS_KEY)
    author = await factories.user().save()
  })

  after(() => redis().del(QUIET_LINE_REDIS_KEY))

  describe('markGroups', () => {
    it('marks a group with fewer feed posts than the line as quiet, and one at the line as busy', async () => {
      const quiet = await factories.group().save()
      const busy = await factories.group().save()
      await postsIn(quiet, 2)
      await postsIn(busy, 3)

      await markGroups(3)

      expect((await settingsOf(quiet)).below_activity_benchmark).to.equal(true)
      expect((await settingsOf(busy)).below_activity_benchmark).to.equal(false)
      expect((await settingsOf(busy)).feed_posts_last_28_days).to.equal(3)
      expect((await settingsOf(busy)).activity_benchmark_measured_at).to.be.a('string')
    })

    it('counts only feed posts from the last 28 days', async () => {
      const group = await factories.group().save()
      await postsIn(group, 3, { type: 'chat' })
      await postsIn(group, 1, { type: 'thread' })
      await postsIn(group, 3, { createdAt: daysAgo(30) })
      await postsIn(group, 1)

      await markGroups(2)

      const settings = await settingsOf(group)
      expect(settings.feed_posts_last_28_days).to.equal(1)
      expect(settings.below_activity_benchmark).to.equal(true)
    })

    it('clears the flag when a group gets busier', async () => {
      const group = await factories.group().save()
      await postsIn(group, 1)
      await markGroups(2)
      expect((await settingsOf(group)).below_activity_benchmark).to.equal(true)

      await postsIn(group, 1)
      await markGroups(2)
      expect((await settingsOf(group)).below_activity_benchmark).to.equal(false)
    })

    it('measures a space on its own, apart from its parent group', async () => {
      const parent = await factories.group().save()
      const space = await factories.group({ type: 'space', parent_id: parent.id }).save()
      await postsIn(parent, 3)
      await postsIn(space, 1)

      await markGroups(2)

      expect((await settingsOf(parent)).below_activity_benchmark).to.equal(false)
      expect((await settingsOf(space)).below_activity_benchmark).to.equal(true)
    })

    it("keeps the group's other settings", async () => {
      const group = await factories.group({ settings: { showSuggestedSkills: true } }).save()
      await markGroups(2)
      const settings = await settingsOf(group)
      expect(settings.showSuggestedSkills).to.equal(true)
      expect(settings.below_activity_benchmark).to.equal(true)
    })
  })

  describe('the quiet line', () => {
    const healthyGroup = async ({ members = 10, recentFeedPosts = 0 } = {}) => {
      const group = await factories.group().save()
      const users = []
      for (let i = 0; i < members; i++) users.push(await factories.user().save())
      await group.addMembers(users.map(u => u.id))
      // One member acts in each of the last seven weeks
      for (let week = 0; week < 7; week++) {
        await postIn(group, { userId: users[week].id, createdAt: daysAgo(week * 7 + 1) })
      }
      await postsIn(group, recentFeedPosts, { userId: users[0].id })
      return group
    }

    it('defaults to 28 feed posts', async () => {
      expect(QUIET_LINE_DEFAULT).to.equal(28)
      expect(await quietLine()).to.equal(28)
    })

    it('becomes the busiest healthy group’s 28-day feed-post count', async () => {
      // Weeks 0 to 3 fall inside 28 days, so 4 + 16 = 20
      await healthyGroup({ recentFeedPosts: 16 })
      const stored = await recalculateQuietLine()
      expect(stored.line).to.equal(20)
      expect(stored.healthyGroups).to.equal(1)
      expect(await quietLine()).to.equal(20)
    })

    it('stays at least 14', async () => {
      await healthyGroup()
      expect((await recalculateQuietLine()).line).to.equal(14)
    })

    it('ignores groups with too few members', async () => {
      await healthyGroup({ members: 9, recentFeedPosts: 30 })
      expect((await recalculateQuietLine()).line).to.equal(QUIET_LINE_DEFAULT)
    })

    it('keeps the previous line when no group qualifies', async () => {
      await redis().set(QUIET_LINE_REDIS_KEY, JSON.stringify({ line: 33, computedAt: daysAgo(40).toISOString() }))
      const stored = await recalculateQuietLine()
      expect(stored.line).to.equal(33)
      expect(stored.healthyGroups).to.equal(0)
    })
  })

  describe('runDaily', () => {
    it('uses the stored line until it is a month old', async () => {
      await redis().set(QUIET_LINE_REDIS_KEY, JSON.stringify({ line: 2, computedAt: daysAgo(3).toISOString() }))
      const group = await factories.group().save()
      await postsIn(group, 2)

      const { line } = await runDaily()

      expect(line).to.equal(2)
      expect((await settingsOf(group)).below_activity_benchmark).to.equal(false)
    })

    it('recalculates a line older than a month', async () => {
      await redis().set(QUIET_LINE_REDIS_KEY, JSON.stringify({ line: 2, computedAt: daysAgo(31).toISOString() }))
      const group = await factories.group().save()
      await postsIn(group, 2)

      const { line } = await runDaily()

      expect(line).to.equal(2)
      const stored = JSON.parse(await redis().get(QUIET_LINE_REDIS_KEY))
      expect(Date.now() - new Date(stored.computedAt)).to.be.below(5 * 60000)
      expect((await settingsOf(group)).below_activity_benchmark).to.equal(false)
    })
  })
})
