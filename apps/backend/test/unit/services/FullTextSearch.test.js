/* globals FullTextSearch, describe, it, expect */
require('../../setup')

describe('FullTextSearch', () => {
  it('sets up, refreshes, and drops the materialied view', function () {
    this.timeout(5000)
    return FullTextSearch.dropView()
      .then(() => FullTextSearch.createView())
      .then(() => FullTextSearch.refreshView())
      .then(() => FullTextSearch.dropView())
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
      expect(query).to.contain('limit 11')
      expect(query).to.contain('offset 20')
    })

    it('produces the expected SQL for a member group semi-join', () => {
      const opts = { limit: 10, offset: 0, term: 'zounds', type: 'person' }
      const query = FullTextSearch.buildSearchInGroupsQuery({ userId: 42 }, opts).toString()

      expect(query).to.contain('"group_id" in (select "groups"."id" from "group_memberships"')
      expect(query).to.contain('where "group_memberships"."user_id" = 42')
      expect(query).not.to.contain('count(*) over ()')
      expect(query).to.contain('limit 11')
    })
  })
})
