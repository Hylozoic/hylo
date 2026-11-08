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
      expect(query).not.to.contain('"group_id" is null')
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

describe('.search (type group)', () => {
  it('includes group_id in SELECT for buildSearchInGroupsQuery', () => {
    const opts = { limit: 10, offset: 0, term: 'plant', type: 'person' }
    const query = FullTextSearch.buildSearchInGroupsQuery({ groupIds: [3] }, opts).toString()

    expect(query).to.contain('"search"."group_id"')
    expect(query).to.contain('"search"."post_id"')
    expect(query).to.contain('"search"."user_id"')
    expect(query).to.contain('"search"."comment_id"')
    expect(query).to.contain('"search"."rank"')
  })

  it('produces group_id is not null filter for type group', () => {
    const opts = { limit: 10, offset: 0, term: 'plant', type: 'group' }
    const query = FullTextSearch.buildSearchInGroupsQuery({ groupIds: [3] }, opts).toString()

    expect(query).to.contain('group_id is not null')
    expect(query).not.to.contain('user_id is not null')
    expect(query).not.to.contain('post_id is not null')
    expect(query).not.to.contain('comment_id is not null')
  })

  it('filters by group_id when explicit groupIds are given', () => {
    const opts = { limit: 10, offset: 0, term: 'plant', type: 'group' }
    const query = FullTextSearch.buildSearchInGroupsQuery({ groupIds: [3, 5] }, opts).toString()

    expect(query).to.contain('"group_id" in (3, 5)')
    expect(query).not.to.contain('"group_id" is null')
  })

  it('restricts to public + member groups + related PROTECTED groups for authenticated users', () => {
    const opts = { limit: 10, offset: 0, term: 'plant', type: 'group' }
    const query = FullTextSearch.buildSearchInGroupsQuery({ userId: 42 }, opts).toString()

    // Must include OR group_id IN (select id from groups WHERE visibility = 2 OR ...)
    expect(query).to.contain('"group_id" in (select "id" from "groups" where')
    // Must include public visibility = 2 check
    expect(query).to.contain('"groups"."visibility" = 2')
    // Must include member groups subquery
    expect(query).to.contain('"group_memberships"."user_id" = 42')
    // Must include PROTECTED + related groups via group_relationships
    expect(query).to.contain('"groups"."visibility" = 1')
    // Must reference group_relationships for parent/child/peer lookups
    expect(query).to.contain('"group_relationships"')
    expect(query).to.contain('"parent_group_id"')
    expect(query).to.contain('"child_group_id"')
    // A null group_id matches every post, person, and comment and would drop this scope
    expect(query).not.to.contain('"group_id" is null')
    // Spaces must be excluded
    expect(query).to.contain('"groups"."type"')
  })

  it('includes PROTECTED groups related to member groups in either direction, regardless of relationship type', () => {
    const opts = { limit: 10, offset: 0, term: 'plant', type: 'group' }
    const query = FullTextSearch.buildSearchInGroupsQuery({ userId: 42 }, opts).toString()

    // Both directions: member group as parent, and member group as child
    expect(query).to.contain('select "child_group_id" from "group_relationships"')
    expect(query).to.contain('select "parent_group_id" from "group_relationships"')
    expect(query).to.contain(' union ')
    // Parent/child and peer relationships are treated the same
    expect(query).not.to.contain('"relationship_type"')
    // Posts, people, and comments are admitted by their own filters, not by a null group_id
    expect(query).not.to.contain('"group_id" is null')
    expect(query).to.contain('"groups_posts"')
    expect(query).to.contain('"group_memberships"')
  })

  it('restricts to public-only groups for anonymous users', () => {
    const opts = { limit: 10, offset: 0, term: 'plant', type: 'group' }
    const query = FullTextSearch.buildSearchInGroupsQuery({}, opts).toString()
    // Default groupAccess with no userId and no groupIds means anonymous
    // Must contain: group_id IN (select id from groups where visibility = 2)
    expect(query).to.contain('"visibility" = 2')
    expect(query).not.to.contain('"group_id" is null')
    expect(query).to.contain('is_public')
  })
})
