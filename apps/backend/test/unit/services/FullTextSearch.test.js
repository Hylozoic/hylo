/* globals FullTextSearch, Skill, User, bookshelf, describe, it, expect, before, after */
const setup = require('../../setup')
const factories = require('../../setup/factories')

const DAY = 24 * 60 * 60 * 1000
const daysAgo = days => new Date(Date.now() - days * DAY)

describe('FullTextSearch', () => {
  it('sets up, refreshes, and drops the materialied view', function () {
    this.timeout(5000)
    return FullTextSearch.dropView()
      .then(() => FullTextSearch.createView())
      .then(() => FullTextSearch.refreshView())
      .then(() => FullTextSearch.dropView())
  })

  describe('people index', () => {
    let haver, learner

    before(async function () {
      this.timeout(10000)
      haver = await new User({ name: 'Skill Haver', email: 'haver@skills.test', active: true }).save()
      learner = await new User({ name: 'Skill Learner', email: 'learner@skills.test', active: true }).save()
      const skill = await new Skill({ name: 'woodturning' }).save()
      await bookshelf.knex('skills_users').insert([
        { skill_id: skill.id, user_id: haver.id, type: Skill.Type.HAS },
        { skill_id: skill.id, user_id: learner.id, type: Skill.Type.LEARNING }
      ])
      await FullTextSearch.dropView()
      await FullTextSearch.createView()
    })

    after(() => FullTextSearch.dropView())

    it('indexes the skills a person has, not the ones they are learning', async () => {
      const rows = await FullTextSearch.search({ term: 'woodturning', type: 'person', subquery: true })
      const userIds = rows.map(r => String(r.user_id))
      expect(userIds).to.include(String(haver.id))
      expect(userIds).not.to.include(String(learner.id))
    })
  })

  describe('ranking', () => {
    let group, namedLongAgo, mentionedInBio, cityDweller, titledPost, freshComment

    before(async function () {
      this.timeout(20000)
      await setup.clearDb()
      group = await factories.group().save()
      namedLongAgo = await factories.user({ name: 'Zephyrine Quillon' }).save()
      mentionedInBio = await factories.user({ name: 'Robin Other', bio: 'Big fan of Zephyrine and her garden' }).save()
      cityDweller = await factories.user({ name: 'Casey Lane', location: 'Bellingham, Washington', tagline: 'Tends the orchard' }).save()
      await group.addMembers([namedLongAgo.id, mentionedInBio.id, cityDweller.id])
      await bookshelf.knex('group_memberships').where({ user_id: namedLongAgo.id }).update({ created_at: daysAgo(700) })
      await bookshelf.knex('users').where({ id: namedLongAgo.id }).update({ last_active_at: daysAgo(700), updated_at: daysAgo(700) })

      titledPost = await factories.post({ user_id: cityDweller.id, name: 'Seedling swap', description: '', type: 'discussion' }).save()
      await bookshelf.knex('posts').where({ id: titledPost.id }).update({ updated_at: daysAgo(45) })
      const otherPost = await factories.post({ user_id: cityDweller.id, name: 'Weekly notes', description: '', type: 'discussion' }).save()
      await bookshelf.knex('groups_posts').insert([
        { group_id: group.id, post_id: titledPost.id },
        { group_id: group.id, post_id: otherPost.id }
      ])
      freshComment = await factories.comment({ user_id: mentionedInBio.id, post_id: otherPost.id, text: 'Anyone have a seedling to share?' }).save()

      await FullTextSearch.dropView()
      await FullTextSearch.createView()
    })

    after(() => FullTextSearch.dropView())

    const search = (term, type) => FullTextSearch.searchInGroups({ groupIds: [group.id] }, { term, type, limit: 10 })

    it('ranks an old exact name match above a fresh mention in a bio', async () => {
      const { items } = await search('zephyrine', 'person')
      expect(items.map(i => String(i.user_id))).to.deep.equal([String(namedLongAgo.id), String(mentionedInBio.id)])
    })

    it('finds a person by the city they live in or their tagline', async () => {
      const byCity = await search('bellingham', 'person')
      expect(byCity.items.map(i => String(i.user_id))).to.deep.equal([String(cityDweller.id)])
      const byTagline = await search('orchard', 'person')
      expect(byTagline.items.map(i => String(i.user_id))).to.deep.equal([String(cityDweller.id)])
    })

    it('ranks an older post with the term in its title above a fresh comment', async () => {
      const { items } = await search('seedling')
      const keys = items.map(i => i.post_id ? `post-${i.post_id}` : `comment-${i.comment_id}`)
      expect(keys).to.deep.equal([`post-${titledPost.id}`, `comment-${freshComment.id}`])
    })

    it('decays posts and comments over 90 days, and not people', () => {
      expect(FullTextSearch.RECENCY_DECAY_DAYS).to.equal(90)
      const query = FullTextSearch.buildSearchInGroupsQuery({ groupIds: [3] }, { term: 'zounds', limit: 10 }).toString()
      expect(query).to.contain('when search.user_id is not null or search.sort_ts is null then search.rank')
      expect(query).to.contain(`/ ${90 * 24 * 60 * 60}.0`)
      expect(query).not.to.contain('exp(')
    })
  })

  describe('.searchInGroups', () => {
    it('produces the expected SQL for explicit group ids', () => {
      const opts = { limit: 10, offset: 20, term: 'zounds', type: 'person' }
      const query = FullTextSearch.buildSearchInGroupsQuery({ groupIds: [3, 5] }, opts).toString()

      expect(query).to.contain('ts_rank_cd(document, to_tsquery(\'english\', \'zounds:*\'))')
      expect(query).to.contain('sort_ts')
      expect(query).to.contain('"group_id" in (3, 5)')
      expect(query).to.contain('search.sort_ts')
      expect(query).not.to.contain('count(*) over ()')
      expect(query).not.to.contain('left join "comments"')
      expect(query).not.to.contain('is_public')
      expect(query).to.contain('limit 11')
      expect(query).to.contain('offset 20')
    })

    it('produces the expected SQL for a member group semi-join', () => {
      const opts = { limit: 10, offset: 0, term: 'zounds', type: 'person' }
      const query = FullTextSearch.buildSearchInGroupsQuery({ userId: 42 }, opts).toString()

      expect(query).to.contain('"group_id" in (select "groups"."id" from "group_memberships"')
      expect(query).to.contain('where "group_memberships"."user_id" = 42')
      expect(query).to.contain('is_public')
      expect(query).not.to.contain('count(*) over ()')
      expect(query).to.contain('limit 11')
    })

    it('strips tsquery operators from the search term', () => {
      const opts = { limit: 10, offset: 0, term: '#release!', type: 'person' }
      const query = FullTextSearch.buildSearchInGroupsQuery({ groupIds: [3] }, opts).toString()

      expect(query).to.contain('to_tsquery(\'english\', \'release:*\')')
      expect(query).not.to.contain('#release')
    })

    it('matches nothing when the term is only tsquery operators', () => {
      const opts = { limit: 10, offset: 0, term: '!!!', type: 'person' }
      const query = FullTextSearch.buildSearchInGroupsQuery({ groupIds: [3] }, opts).toString()

      expect(query).to.contain('where false')
      expect(query).not.to.contain('to_tsquery')
    })
  })
})
