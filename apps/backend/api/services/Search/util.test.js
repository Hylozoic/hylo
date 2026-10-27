/* eslint-disable no-unused-expressions */
import { filterAndSortPosts, filterAndSortGroups, filterAndSortUsers } from './util'
import { expectEqualQuery } from '../../../test/setup/helpers'
import factories from '../../../test/setup/factories'

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

  it('ignores a search with no usable words', () => {
    const relation = Group.collection()
    relation.query(q => {
      filterAndSortGroups({ search: '(&' }, q)
    })

    expectEqualQuery(relation, 'select * from "groups" order by "name" asc')
  })

  it('treats special characters as word breaks', () => {
    const relation = Group.collection()
    relation.query(q => {
      filterAndSortGroups({ search: 'a:b:c' }, q)
    })

    expectEqualQuery(relation, `select * from "groups" where (((to_tsvector('english', groups.name) @@ to_tsquery('a:* & b:* & c:*')) or (to_tsvector('english', groups.description) @@ to_tsquery('a:* & b:* & c:*')) or (to_tsvector('english', groups.location) @@ to_tsquery('a:* & b:* & c:*')))) order by "name" asc`)
  })
})

describe('filterAndSortUsers', () => {
  const nameOrder = `order by (coalesce("users"."name", '') !~ '\\S') asc, lower(trim("users"."name")) asc`

  it('filters and ranks by name for autocomplete', () => {
    const relation = User.collection()
    relation.query(q => {
      filterAndSortUsers({ autocomplete: 'al bo' }, q)
    })

    expectEqualQuery(relation, `select * from "users"
      where to_tsvector('simple', users.name) @@ to_tsquery('simple', 'al:* & bo:*')
      order by ts_rank_cd(to_tsvector('simple', users.name), to_tsquery('simple', 'al:* & bo:*')) DESC,
      (coalesce("users"."name", '') !~ '\\S') asc, lower(trim("users"."name")) asc`)
  })

  it('treats special characters as word breaks', () => {
    const relation = User.collection()
    relation.query(q => {
      filterAndSortUsers({ autocomplete: 'a:b:c' }, q)
    })

    expectEqualQuery(relation, `select * from "users"
      where to_tsvector('simple', users.name) @@ to_tsquery('simple', 'a:* & b:* & c:*')
      order by ts_rank_cd(to_tsvector('simple', users.name), to_tsquery('simple', 'a:* & b:* & c:*')) DESC,
      (coalesce("users"."name", '') !~ '\\S') asc, lower(trim("users"."name")) asc`)
  })

  it('skips the name filter when autocomplete is only whitespace', () => {
    const relation = User.collection()
    relation.query(q => {
      filterAndSortUsers({ autocomplete: ' ' }, q)
    })

    expectEqualQuery(relation, `select * from "users" ${nameOrder}`)
  })

  it('skips the name filter when autocomplete is only punctuation', () => {
    const relation = User.collection()
    relation.query(q => {
      filterAndSortUsers({ autocomplete: '(&' }, q)
    })

    expectEqualQuery(relation, `select * from "users" ${nameOrder}`)
  })
})

describe('name search terms against Postgres', () => {
  // Realistic names and stray characters people type into the search boxes.
  // Each must run without a tsquery syntax error.
  const terms = [
    "o'brien", '"quoted"', 'a<b', 'a>b', 'a*', '#tag', 'foo-bar', "foo's bar",
    '<->', '!', "'", "'abc", 'a<-', 'a<2>b', 'a!b', 'a:b:c', 'José', 'Zoë', '李'
  ]

  let users

  before(async () => {
    users = await Promise.all(["Sinéad O'Brien", 'José Zoë Müller', '李明'].map(name =>
      factories.user({ name }).save()))
  })

  after(() => Promise.all(users.map(u => u.destroy())))

  const userNames = autocomplete => User.collection()
    .query(q => {
      filterAndSortUsers({ autocomplete }, q)
      q.whereIn('users.id', users.map(u => u.id))
    })
    .fetch()
    .then(c => c.map(u => u.get('name')))

  terms.forEach(term => {
    it(`runs the people autocomplete query for ${JSON.stringify(term)}`, () =>
      userNames(term))

    it(`runs the group search query for ${JSON.stringify(term)}`, () =>
      Group.collection().query(q => filterAndSortGroups({ search: term }, q)).fetch())
  })

  it('finds names with an apostrophe', async () => {
    expect(await userNames("o'brien")).to.deep.equal(["Sinéad O'Brien"])
    expect(await userNames("sinéad o'b")).to.deep.equal(["Sinéad O'Brien"])
  })

  it('keeps non-Latin letters', async () => {
    expect(await userNames('josé')).to.deep.equal(['José Zoë Müller'])
    expect(await userNames('Zoë mü')).to.deep.equal(['José Zoë Müller'])
    expect(await userNames('李')).to.deep.equal(['李明'])
  })
})
