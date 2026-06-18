import { filterAndSortPosts, filterAndSortGroups, isChatPostsFilter, restrictChatPostsToMembers } from './util'
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
      filterAndSortPosts({sortBy: 'posts.updated_at'}, query)
    }).not.to.throw()
  })

  it('accepts new sort values', () => {
    expect(() => {
      filterAndSortPosts({sortBy: 'updated'}, query)
    }).not.to.throw()
  })

  it('rejects bad sort values', () => {
    expect(() => {
      filterAndSortPosts({sortBy: 'foo'}, query)
    }).to.throw()
  })

  it('allows topic IDs', () => {
    filterAndSortPosts({topic: '122'}, query)
    expect(query.join).to.have.been.called.with('posts_tags', 'posts_tags.post_id', 'posts.id')
    expect(query.whereIn).to.have.been.called.with('posts_tags.tag_id', ['122'])
  })

  it('allows topic names', () => {
    filterAndSortPosts({topic: 'design'}, query)
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
      filterAndSortPosts({type: 'blah'}, query)
    }).to.throw(/unknown post type/)
  })

  it('includes basic types when filter is blank', () => {
    filterAndSortPosts({}, query)
    expectEqualQuery(relation, `select * from "posts"
      where "posts"."type" in ('discussion', 'request', 'offer', 'project', 'proposal', 'event', 'resource')
      order by "posts"."updated_at" desc`)
  })
})

describe('isChatPostsFilter', () => {
  it('detects chat filter values', () => {
    expect(isChatPostsFilter({ filter: 'chat' })).to.be.true
    expect(isChatPostsFilter({ type: 'chat' })).to.be.true
    expect(isChatPostsFilter({ types: ['chat'] })).to.be.true
    expect(isChatPostsFilter({ filter: 'discussion' })).to.be.false
  })
})

describe('restrictChatPostsToMembers', () => {
  it('excludes chat posts when user is not a group member', async () => {
    const member = await factories.user().save()
    const outsider = await factories.user().save()
    const group = await factories.group({ visibility: Group.Visibility.PUBLIC }).save()
    await member.joinGroup(group)
    const post = await factories.post({ type: Post.Type.CHAT, user_id: member.id }).save()
    await group.posts().attach(post)

    const outsiderPosts = await group.posts().query(q => {
      restrictChatPostsToMembers(q, { userId: outsider.id, groupId: group.id })
      filterAndSortPosts({ type: 'chat' }, q)
    }).fetch()

    expect(outsiderPosts.length).to.equal(0)

    const memberPosts = await group.posts().query(q => {
      restrictChatPostsToMembers(q, { userId: member.id, groupId: group.id })
      filterAndSortPosts({ type: 'chat' }, q)
    }).fetch()

    expect(memberPosts.models.map(p => p.id)).to.include(post.id)
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
