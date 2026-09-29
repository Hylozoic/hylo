import { DateTime } from 'luxon'
import { expectEqualQuery } from '../../setup/helpers'
import setup from '../../setup'
import factories from '../../setup/factories'
import { RECENT_ACTIVITY_WINDOW_DAYS, filterAndSortUsers } from '../../../api/services/Search/util'

const DAY = 24 * 60 * 60 * 1000

async function addGroupPost (group, user, daysAgo, attrs = {}) {
  const createdAt = new Date(Date.now() - daysAgo * DAY)
  const post = await factories.post({ user_id: user.id, type: 'discussion', created_at: createdAt, updated_at: createdAt, ...attrs }).save()
  await bookshelf.knex('groups_posts').insert({ group_id: group.id, post_id: post.id })
  return post
}

describe('Search', function () {
  describe('.forPosts', function () {
    // TODO: fix this by reorganizing the search and filter code for posts to join groups_posts in the right place
    it.skip('produces the expected SQL for a complex query', function () {
      const start = DateTime.fromISO('2015-03-24 19:54:12-04:00')
      const end = DateTime.fromISO('2015-03-31 19:54:12-04:00')
      const startAsString = start.toFormat('yyyy-MM-dd HH:mm:ss.SSS')
      const endAsString = end.toFormat('yyyy-MM-dd HH:mm:ss.SSS')

      const search = Search.forPosts({
        limit: 5,
        offset: 7,
        users: [42, 41],
        groupIds: [9, 12],
        follower: 37,
        term: 'milk toast',
        type: 'request',
        start_time: start.toDate(),
        end_time: end.toDate(),
        sort: 'posts.updated_at'
      })

      expectEqualQuery(search, `select posts.*, count(*) over () as total, "groups_posts"."pinned"
        from "posts"
        inner join "posts_users" as "post_followers" on "post_followers"."post_id" = "posts"."id"
        inner join "groups_posts" on "groups_posts"."post_id" = "posts"."id"
        where "posts"."active" = true
        and "posts"."user_id" in (42, 41)
        and "post_followers"."active" = true
        and "post_followers"."following" = true
        and "post_followers"."user_id" = 37
        and (posts.user_id != 37 or posts.user_id is null)
        and ((posts.created_at between '${startAsString}' and '${endAsString}')
          or (posts.updated_at between '${startAsString}' and '${endAsString}'))
        and "posts"."type" = 'request'
        and (((to_tsvector('english', posts.name) @@ to_tsquery('milk:* & toast:*'))
        or (to_tsvector('english', posts.description) @@ to_tsquery('milk:* & toast:*'))))
        and "groups_posts"."group_id" in (9, 12)
        and "parent_post_id" is null
        group by "posts"."id", "groups_posts"."post_id", "groups_posts"."pinned"
        order by "posts"."updated_at" desc
        limit 5
        offset 7`)
    })

    it('includes stream post types without notices by default', () => {
      const query = Search.forPosts({ groups: 9 }).query().toString()
      expect(query).to.contain('"posts"."type" in (\'discussion\', \'request\', \'offer\', \'project\', \'proposal\', \'event\', \'resource\')')
    })

    it('includes stream post types without notices when type is "all"', () => {
      const query = Search.forPosts({ groups: 9, type: 'all' }).query().toString()
      expect(query).to.contain('"posts"."type" in (\'discussion\', \'request\', \'offer\', \'project\', \'proposal\', \'event\', \'resource\')')
    })

    it('includes stream post types and notices when type is "all+notices"', () => {
      const query = Search.forPosts({ groups: 9, type: 'all+notices' }).query().toString()
      expect(query).to.contain('"posts"."type" in (\'discussion\', \'request\', \'offer\', \'project\', \'proposal\', \'event\', \'resource\', \'chat_activity\')')
    })

    it('keeps Axolotl notice posts in multi-group streams', () => {
      const query = Search.forPosts({ groupIds: [9, 12] }).query().toString()
      expect(query).to.contain(`"posts"."user_id" != '${User.AXOLOTL_ID}'`)
      expect(query).to.contain("'chat_activity'")
    })

    it('accepts an option to change the name of the total column', () => {
      const query = Search.forPosts({totalColumnName: 'wowee'}).query().toString()
      expect(query).to.contain('count(*) over () as wowee')
    })
  })

  describe('.forGroups', function () {
    it('produces the expected SQL for a complex query', function () {
      const search = Search.forGroups({
        limit: 10,
        offset: 20,
        term: 'milk toast',
        sort: 'name'
      })

      expectEqualQuery(search, `select groups.*, count(*) over () as total
        from "groups"
        where ("groups"."type" is null or "groups"."type" <> 'space')
        and (((to_tsvector('english', groups.name) @@ to_tsquery('milk:* & toast:*'))
        or (to_tsvector('english', groups.description) @@ to_tsquery('milk:* & toast:*'))
        or (to_tsvector('english', groups.location) @@ to_tsquery('milk:* & toast:*'))))
        order by "name" asc
        limit 10
        offset 20`)
    })

    it('includes spaces when parentSlugs is given', () => {
      const query = Search.forGroups({
        limit: 10,
        parentSlugs: ['house']
      }).query().toString()
      expect(query).to.contain('"groups"."type" = \'space\'')
      expect(query).to.contain('"groups"."parent_id"')
      expect(query).to.not.match(/"groups"\."type" is null or "groups"\."type" <> 'space'/)
    })

    it('includes spaces when groupType is space', () => {
      const query = Search.forGroups({
        limit: 10,
        groupType: 'space'
      }).query().toString()
      expect(query).to.contain('"groups"."type" = \'space\'')
      expect(query).to.not.match(/"groups"\."type" is null or "groups"\."type" <> 'space'/)
    })

    it('includes spaces when fetching explicit groupIds', () => {
      const query = Search.forGroups({
        limit: 10,
        groupIds: ['1', '2']
      }).query().toString()
      expect(query).to.contain('"groups"."id" in')
      expect(query).to.not.match(/"groups"\."type" is null or "groups"\."type" <> 'space'/)
    })

    it('includes nearest if nearCoord is passed in', () => {
      const query = Search.forGroups({
        limit: 10,
        offset: 20,
        term: 'milk toast',
        sort: 'nearest',
        nearCoord: {lat: 45, lng: 45}
      }).query().toString()
      expect(query).to.contain('SELECT groups.id, ST_Distance(t.x, locations.center) AS nearest')
    })

    it('includes group membership count if sorting by size', () => {
      const query = Search.forGroups({
        limit: 10,
        offset: 20,
        term: 'milk toast',
        sort: 'size',
      }).query().toString()
      expect(query).to.contain('SELECT group_id, COUNT(group_id) as size from group_memberships GROUP BY group_id')
    })

    describe('for the main search', () => {
      let viewer, mine, child, peer

      before(async () => {
        viewer = await factories.user().save()
        mine = await factories.group({ name: 'Walnut Mine', visibility: 1 }).save()
        await factories.group({ name: 'Walnut Listed', visibility: 2, allow_in_public: true }).save()
        await factories.group({ name: 'Walnut Unlisted', visibility: 2, allow_in_public: false }).save()
        child = await factories.group({ name: 'Walnut Child', visibility: 1 }).save()
        const hiddenChild = await factories.group({ name: 'Walnut Hidden', visibility: 0 }).save()
        peer = await factories.group({ name: 'Walnut Peer', visibility: 1 }).save()
        await factories.group({ name: 'Walnut Stranger', visibility: 1 }).save()
        await factories.group({ name: 'Walnut Gone', visibility: 2, allow_in_public: true, active: false }).save()
        await factories.group({ name: 'Walnut Space', visibility: 2, allow_in_public: true, type: 'space', parent_id: mine.id }).save()
        await mine.addMembers([viewer.id])
        const now = new Date()
        await bookshelf.knex('group_relationships').insert([
          { parent_group_id: mine.id, child_group_id: child.id, active: true, relationship_type: 0, created_at: now, updated_at: now },
          { parent_group_id: mine.id, child_group_id: hiddenChild.id, active: true, relationship_type: 0, created_at: now, updated_at: now },
          { parent_group_id: peer.id, child_group_id: mine.id, active: true, relationship_type: 1, created_at: now, updated_at: now }
        ])
      })

      it("finds the viewer's groups, listed Public groups and related groups that aren't hidden", async () => {
        const groups = await Search.forGroups({ term: 'walnut', discoverableBy: viewer.id, sort: 'recent', limit: 20 }).fetchAll()
        expect(groups.map(g => g.get('name')).sort()).to.deep.equal(['Walnut Child', 'Walnut Listed', 'Walnut Mine', 'Walnut Peer'])
      })

      it('matches the search term', async () => {
        const groups = await Search.forGroups({ term: 'listed', discoverableBy: viewer.id, sort: 'recent', limit: 20 }).fetchAll()
        expect(groups.map(g => g.get('name'))).to.deep.equal(['Walnut Listed'])
      })
    })

    describe('sorted by recent activity', () => {
      let busy, lively, quiet, dormant

      before(async () => {
        const author = await factories.user().save()
        busy = await factories.group({ name: 'Zinnia Growers' }).save()
        lively = await factories.group({ name: 'Yarrow Circle' }).save()
        quiet = await factories.group({ name: 'Aster Friends' }).save()
        dormant = await factories.group({ name: 'Bramble Club' }).save()

        await addGroupPost(busy, author, 1)
        await addGroupPost(busy, author, 5)
        await addGroupPost(lively, author, 10)
        // Welcome posts, removed posts and posts before the window don't count
        await addGroupPost(lively, author, 0, { type: 'welcome' })
        await addGroupPost(quiet, author, 2, { active: false })
        await addGroupPost(dormant, author, RECENT_ACTIVITY_WINDOW_DAYS + 3)
        await addGroupPost(dormant, author, RECENT_ACTIVITY_WINDOW_DAYS + 30)
      })

      it('puts groups with the most posts in the window first, then the rest by name', async () => {
        const groups = await Search.forGroups({
          sort: 'recent',
          groupIds: [dormant.id, quiet.id, lively.id, busy.id],
          limit: 10
        }).fetchAll()
        expect(groups.map(g => g.get('name'))).to.deep.equal(['Zinnia Growers', 'Yarrow Circle', 'Aster Friends', 'Bramble Club'])
      })

      it('counts posts only inside the window', () => {
        const query = Search.forGroups({ limit: 10, sort: 'recent' }).query().toString()
        expect(query).to.contain(`make_interval(days => ${RECENT_ACTIVITY_WINDOW_DAYS})`)
        expect(query).to.contain('left join "recent_activity"')
      })
    })
  })

  describe('.forUsers', () => {
    let cat, dog, catdog, house, mouse, mouseGroup

    before(() => {
      cat = new User({ name: 'Mister Cat', email: 'iam@cat.org', active: true })
      dog = new User({ name: 'Mister Dog', email: 'iam@dog.org', active: true })
      mouse = new User({ name: 'Mister Mouse', email: 'iam@mouse.org', active: true })
      catdog = new User({ name: 'Cat Dog', email: 'iam@catdog.org', active: true })
      house = new Group({ name: 'House', slug: 'House' })
      mouseGroup = new Group({ name: 'MouseGroup', slug: 'MouseGroup' })

      return setup.clearDb()
        .then(() => cat.save())
        .then(() => dog.save())
        .then(() => catdog.save())
        .then(() => mouse.save())
        .then(() => house.save())
        .then(() => mouseGroup.save())
        .then(() => cat.joinGroup(house))
        .then(() => mouse.joinGroup(mouseGroup))
        .then(() => FullTextSearch.dropView().catch(err => {})) // eslint-disable-line n/handle-callback-err
        .then(() => FullTextSearch.createView())
    })

    function userSearchTests (key) {
      it('finds members based on name', () => {
        return Search.forUsers({[key]: 'mister'}).fetchAll().then(users => {
          expect(users.length).to.equal(3)
        })
      })

      it('doesn\'t find members by letters in the middle or end of their name', () => {
        return Search.forUsers({[key]: 'ister'}).fetchAll().then(users => {
          expect(users.length).to.equal(0)
        })
      })

      it('finds members by the beginning letters of their first or last name', () => {
        return Search.forUsers({[key]: 'Cat'}).fetchAll().then(users => {
          expect(users.length).to.equal(2)
        })
      })
    }

    describe('for autocomplete', () => {
      userSearchTests('autocomplete')
    })

    describe('with a term', () => {
      userSearchTests('term')
    })

    describe('for a group', () => {
      it('finds members', () => {
        return Search.forUsers({term: 'mister', groups: [house.id]}).fetchAll()
          .then(users => {
            expect(users.length).to.equal(1)
            expect(users.first().get('name')).to.equal('Mister Cat')
          })
      })

      it('excludes inactive members', async () => {
        await cat.leaveGroup(house)
        const users = await Search.forUsers({
          term: 'mister', groups: [house.id]
        }).fetchAll()
        expect(users.length).to.equal(0)
      })
    })
  })

  describe('.forUsers sorted by distance', () => {
    let viewer, placeless, near, far, homeless, group, otherGroup

    const place = (lng, lat) => new Location({ center: { lng, lat }, full_text: `${lat}, ${lng}` }).save()

    before(async () => {
      const home = await place(-122.48, 48.75)
      viewer = await factories.user({ name: 'Viewer Person', location_id: home.id }).save()
      placeless = await factories.user({ name: 'Placeless Viewer' }).save()
      near = await factories.user({ name: 'Zed Nearby', location_id: (await place(-122.5, 48.8)).id }).save()
      far = await factories.user({ name: 'Yan Faraway', location_id: (await place(2.35, 48.85)).id }).save()
      homeless = await factories.user({ name: 'Abe Nowhere' }).save()
      group = await factories.group().save()
      otherGroup = await factories.group().save()
      await group.addMembers([near.id, far.id, homeless.id])
      await otherGroup.addMembers([near.id, far.id, homeless.id])
    })

    const names = users => users.map(u => u.get('name'))

    it('puts the nearest people first and people without a location last', async () => {
      const users = await Search.forUsers({ sort: 'location', currentUserId: viewer.id, groups: [group.id] }).fetchAll()
      expect(names(users)).to.deep.equal(['Zed Nearby', 'Yan Faraway', 'Abe Nowhere'])
    })

    it('works across several groups', async () => {
      const users = await Search.forUsers({ sort: 'location', currentUserId: viewer.id, groups: [group.id, otherGroup.id] }).fetchAll()
      expect(names(users)).to.deep.equal(['Zed Nearby', 'Yan Faraway', 'Abe Nowhere'])
    })

    it('falls back to name order when the viewer has no location', async () => {
      const users = await Search.forUsers({ sort: 'location', currentUserId: placeless.id, groups: [group.id] }).fetchAll()
      expect(names(users)).to.deep.equal(['Abe Nowhere', 'Yan Faraway', 'Zed Nearby'])
    })

    it('sorts a group\'s members by distance to the viewer', async () => {
      // As the GraphQL members field runs it: the filter, then pagination's total column
      const members = await group.members().query(q => {
        filterAndSortUsers({ sortBy: 'location', viewerId: viewer.id })(q)
        q.select(bookshelf.knex.raw('users.*, count(*) over () as __total'))
      }).fetch()
      expect(names(members)).to.deep.equal(['Zed Nearby', 'Yan Faraway', 'Abe Nowhere'])
    })
  })
})
