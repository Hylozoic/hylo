/* globals FullTextSearch, Skill, User, bookshelf, describe, it, expect, before, after */
require('../../setup')

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
