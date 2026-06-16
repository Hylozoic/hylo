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
    it('produces the expected SQL', () => {
      const opts = { limit: 10, offset: 20, term: 'zounds', type: 'person' }
      const query = FullTextSearch.searchInGroups([3, 5], opts).toString()

      expect(query).to.equal(`
        select "search"."post_id", "search"."comment_id", "search"."user_id", "rank", "total"
        from (select post_id, comment_id, user_id,
            ts_rank_cd(document, to_tsquery('english', 'zounds:*')) as rank,
            count(*) over () as total
          from "search_index"
          where
            document @@ to_tsquery('english', 'zounds:*')
            and user_id is not null
            and ("post_id" in (select "post_id" from "groups_posts" where "group_id" in (3, 5))
              or "user_id" in (select "user_id" from "group_memberships" where "group_id" in (3, 5))
              or "comment_id" in (select "c"."id" from "comments" as "c"
                inner join "groups_posts" as "gp" on "gp"."post_id" = "c"."post_id"
                where "gp"."group_id" in (3, 5))
              or "post_id" in (select "id" from "posts" where "is_public" = true and "active" = true)
              or "comment_id" in (select "c"."id" from "comments" as "c"
                inner join "posts" as "p" on "p"."id" = "c"."post_id"
                where "p"."is_public" = true and "c"."active" = true))
          order by "rank" desc) as "search"
        left join "comments" on "comments"."id" = "search"."comment_id"
        left join "posts" on "posts"."id" = "search"."post_id" or "posts"."id" = "comments"."post_id"
        left join "group_memberships" on "group_memberships"."user_id" = "search"."user_id"
          and "group_memberships"."group_id" in (3, 5)
        group by "search"."post_id", "search"."comment_id", "search"."user_id", "rank", "total"
        order by (("rank") * (case when greatest(max(posts.updated_at), max(comments.created_at), max(group_memberships.created_at)) is null then 1 else exp(-extract(epoch from (now() - greatest(max(posts.updated_at), max(comments.created_at), max(group_memberships.created_at)))) / 1209600.0) end)) desc, "rank" desc
        limit 10
        offset 20
      `.replace(/(\n\s*)/g, ' ').trim())
    })
  })
})
