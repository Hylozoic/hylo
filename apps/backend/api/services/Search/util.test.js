/* eslint-disable no-unused-expressions */
import { filterAndSortPosts, filterAndSortGroups } from './util'
import { expectEqualQuery } from '../../../test/setup/helpers'

describe('filterAndSortPosts', () => {
  let relation, query

  beforeEach(() => {
    relation = Post.collection()
    relation.query(q => {
      query = q
      spy.on(q, 'join')
      spy.on(q, 'where')
      spy.on(q, 'whereIn')
    })
  })

  it('accepts old sort values', () => {
    expect(() => {
      filterAndSortPosts({ sortBy: 'posts.updated_at' }, query)
    }).not.to.throw()
  })

  it('accepts new sort values', () => {
    expect(() => {
      filterAndSortPosts({ sortBy: 'updated' }, query)
    }).not.to.throw()
  })

  it('rejects bad sort values', () => {
    expect(() => {
      filterAndSortPosts({ sortBy: 'foo' }, query)
    }).to.throw()
  })

  it('allows topic IDs', () => {
    filterAndSortPosts({ topic: '122' }, query)
    expect(query.join).to.have.been.called.with('posts_tags', 'posts_tags.post_id', 'posts.id')
    expect(query.whereIn).to.have.been.called.with('posts_tags.tag_id', ['122'])
  })

  it('allows topic names', () => {
    filterAndSortPosts({ topic: 'design' }, query)
    expect(query.join).to.have.been.called.twice
    expect(query.join.__spy.calls[0]).to.deep.equal([
      'posts_tags', 'posts_tags.post_id', 'posts.id'
    ])
    expect(query.join.__spy.calls[1]).to.deep.equal([
      'tags', 'posts_tags.tag_id', 'tags.id'
    ])
    expect(query.whereIn).to.have.been.called.with('tags.name', ['design'])
  })

  it('rejects bad type values', () => {
    expect(() => {
      filterAndSortPosts({ type: 'blah' }, query)
    }).to.throw(/unknown post type/)
  })

  it('includes basic types without notices when filter is blank', () => {
    filterAndSortPosts({}, query)
    expectEqualQuery(relation, `select * from "posts"
      where "posts"."type" in ('discussion', 'request', 'offer', 'project', 'proposal', 'event', 'resource')
      order by "posts"."updated_at" desc`)
  })

  it('includes notice types when filter is all+notices', () => {
    filterAndSortPosts({ type: 'all+notices' }, query)
    expectEqualQuery(relation, `select * from "posts"
      where "posts"."type" in ('discussion', 'request', 'offer', 'project', 'proposal', 'event', 'resource', 'chat_activity')
      order by "posts"."updated_at" desc`)
  })

  it('does not let an empty types array override all+notices', () => {
    filterAndSortPosts({ type: 'all+notices', types: [] }, query)
    expectEqualQuery(relation, `select * from "posts"
      where "posts"."type" in ('discussion', 'request', 'offer', 'project', 'proposal', 'event', 'resource', 'chat_activity')
      order by "posts"."updated_at" desc`)
  })

  it('does not let a stream-only types array override all+notices', () => {
    filterAndSortPosts({ type: 'all+notices', types: ['discussion', 'request'] }, query)
    expectEqualQuery(relation, `select * from "posts"
      where "posts"."type" in ('discussion', 'request', 'offer', 'project', 'proposal', 'event', 'resource', 'chat_activity')
      order by "posts"."updated_at" desc`)
  })

  it('searches post content and creator name', () => {
    filterAndSortPosts({ search: 'alice' }, query)
    expectEqualQuery(relation, `select * from "posts"
      left join "users" as "post_creators" on "posts"."user_id" = "post_creators"."id"
      where "posts"."type" in ('discussion', 'request', 'offer', 'project', 'proposal', 'event', 'resource')
      and (posts.name ilike '%alice%' or posts.description ilike '%alice%' or post_creators.name ilike '%alice%')
      order by "posts"."updated_at" desc`)
  })
})

describe('filterAndSortGroups', () => {
  it('supports searching', () => {
    const relation = Group.collection()
    relation.query(q => {
      filterAndSortGroups({ search: 'foo' }, q)
    })

    expectEqualQuery(relation, `select * from "groups" where (((to_tsvector('english', groups.name) @@ to_tsquery('foo:*')) or (to_tsvector('english', groups.description) @@ to_tsquery('foo:*')) or (to_tsvector('english', groups.location) @@ to_tsquery('foo:*')))) order by "name" asc`)
  })
})
