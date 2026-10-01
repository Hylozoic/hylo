/* eslint-disable no-unused-expressions */
import { randomUUID } from 'node:crypto'
import jwt from 'jsonwebtoken'
import { createRequestHandler, makeMutations, makeAuthenticatedQueries } from './index'
import '../../test/setup'
import factories from '../../test/setup/factories'
import { mockify, spyify, unspyify, withFeatureFlag } from '../../test/setup/helpers'
import { some } from 'lodash/fp'
import { updateFollowers } from '../models/post/util'

describe('graphql request handler', () => {
  let handler,
    req, res,
    user, user2,
    group,
    post, post2, comment, media, groupExtension, extension

  before(async () => {
    handler = createRequestHandler()

    user = factories.user()
    user2 = factories.user()
    group = factories.group()
    post = factories.post({ type: Post.Type.DISCUSSION })
    post2 = factories.post({ type: Post.Type.REQUEST })
    comment = factories.comment()
    media = factories.media()
    const earlier = new Date(new Date().getTime() - 86400000)
    extension = factories.extension({ type: 'test', created_at: earlier })

    await group.save()
    await user.save()
    await user2.save()
    await post.save({ user_id: user.id })
    await post2.save()
    await comment.save({ post_id: post.id })
    await media.save({ comment_id: comment.id })
    await extension.save()

    groupExtension = factories.groupExtension({ group_id: group.id, extension_id: extension.id, active: true, data: { 'key-test': 'value-test' } })
    await groupExtension.save()
    return Promise.all([
      group.posts().attach(post),
      group.posts().attach(post2),
      group.addMembers([user.id, user2.id]).then((memberships) => {
        const earlier = new Date(new Date().getTime() - 86400000)
        return memberships[0].save({ created_at: earlier }, { patch: true })
      })
    ])
      .then(() => Promise.all([
        updateFollowers(post),
        updateFollowers(post2)
      ]))
  })

  after(async function () {
    await groupExtension.destroy()
    await extension.destroy()
  })

  beforeEach(() => {
    req = factories.mock.request()
    req.url = '/noo/graphql'
    req.method = 'POST'
    req.headers = {
      'Content-Type': 'application/json'
    }
    req.session = {
      userId: user.id,
      destroy: () => {}
    }
    req.user = user
    res = factories.mock.response()
  })

  describe('with a simple query', () => {
    it('responds as expected', async () => {
      // TODO: .inject is no longer provided with Yoga 3.x forward ref. here for what to do instead:
      // https://the-guild.dev/graphql/yoga-server/v3/migration/migration-from-yoga-v2#removed-inject-method
      const { executionResult } = await handler.inject({
        document: `{
          me {
            name
            memberships {
              group {
                name
              }
            }
            posts {
              title
              groups {
                name
              }
            }
          }
        }`,
        serverContext: { req, res }
      })

      return expect(executionResult).to.deep.nested.include({
        data: {
          me: {
            name: user.get('name'),
            memberships: [
              {
                group: {
                  name: group.get('name')
                }
              }
            ],
            posts: [
              {
                title: post.get('name'),
                groups: [
                  {
                    name: group.get('name')
                  }
                ]
              }
            ]
          }
        }
      })
    })
  })

  describe('with a complex query', function () {
    this.timeout(10000)
    let thread, message

    before(async () => {
      thread = factories.post({ type: Post.Type.THREAD })
      await thread.save()
      await comment.save({ user_id: user2.id })

      message = await factories.comment({
        post_id: thread.id,
        user_id: user2.id
      }).save()

      await post.addFollowers([user2.id])
      await thread.addFollowers([user.id, user2.id])
    })

    it('responds as expected', async () => {
      const { executionResult } = await handler.inject({
        document: `{
          me {
            name
            memberships {
              group {
                name
              }
            }
            posts {
              title
              groups {
                name
              }
              comments {
                items {
                  text
                  creator {
                    name
                  }
                }
              }
              followers {
                name
              }
              followersTotal
            }
            messageThreads {
              total
              hasMore
              items {
                id
                messages {
                  items {
                    text
                    creator {
                      name
                    }
                  }
                }
                participants {
                  name
                }
                participantsTotal
              }
            }
          }
        }`,
        serverContext: { req, res }
      })

      return expect(executionResult).to.deep.nested.include({
        data: {
          me: {
            name: user.get('name'),
            memberships: [
              {
                group: {
                  name: group.get('name')
                }
              }
            ],
            posts: [
              {
                title: post.get('name'),
                groups: [
                  {
                    name: group.get('name')
                  }
                ],
                comments: {
                  items: [
                    {
                      text: comment.text(),
                      creator: {
                        name: user2.get('name')
                      }
                    }
                  ]
                },
                followers: [
                  {
                    name: user2.get('name')
                  }
                ],
                followersTotal: 1
              }
            ],
            messageThreads: {
              hasMore: false,
              total: 1,
              items: [
                {
                  id: thread.id,
                  messages: {
                    items: [
                      {
                        text: message.get('text'),
                        creator: {
                          name: user2.get('name')
                        }
                      }
                    ]
                  },
                  participants: [
                    {
                      name: user.get('name')
                    },
                    {
                      name: user2.get('name')
                    }
                  ],
                  participantsTotal: 2
                }
              ]
            }
          }
        }
      })
    })

    it('filters messageThreads by search (case-insensitive)', async () => {
      await user2.save({ name: 'Jodie Crowe' }, { patch: true })
      await message.save({ text: 'Hey Jodie!!' }, { patch: true })

      const { executionResult: noMatch } = await handler.inject({
        document: `{
          me {
            messageThreads(search: "zzznomatch") {
              items { id }
            }
          }
        }`,
        serverContext: { req, res }
      })
      expect(noMatch.data.me.messageThreads.items).to.deep.equal([])

      const { executionResult: byName } = await handler.inject({
        document: `{
          me {
            messageThreads(search: "jodie") {
              items { id }
            }
          }
        }`,
        serverContext: { req, res }
      })
      expect(byName.data.me.messageThreads.items).to.deep.equal([{ id: thread.id }])

      const { executionResult: byMessage } = await handler.inject({
        document: `{
          me {
            messageThreads(search: "hey jodie") {
              items { id }
            }
          }
        }`,
        serverContext: { req, res }
      })
      expect(byMessage.data.me.messageThreads.items).to.deep.equal([{ id: thread.id }])
    })
  })

  describe('querying Comment attachments', () => {
    it('responds as expected', async () => {
      const { executionResult } = await handler.inject({
        document: `{
          post (id: ${post.id}) {
            comments {
              items {
                text
                attachments {
                  id
                  type
                  position
                  url
                }
              }
            }
          }
        }`,
        serverContext: { req, res }
      })

      return expect(executionResult).to.deep.nested.include({
        data: {
          post: {
            comments: {
              items: [
                {
                  text: comment.text(),
                  attachments: [
                    {
                      id: media.id,
                      type: media.get('type'),
                      position: media.get('position'),
                      url: media.get('url')
                    }
                  ]
                }
              ]
            }
          }
        }
      })
    })
  })

  describe('without a logged-in user', () => {
    beforeEach(() => {
      req.session = {}
    })

    it('shows "not logged in" errors for most queries', async () => {
      const { executionResult } = await handler.inject({
        document: `{
          me {
            name
          }
          group(id: 9) {
            name
          }
        }`,
        serverContext: { req, res }
      })

      return expect(executionResult).to.deep.nested.include({
        data: {
          me: null,
          group: null
        }
      })
    })

    it('does not return group members or their contact details', async () => {
      const publicGroup = await factories.group({
        visibility: Group.Visibility.PUBLIC,
        settings: { public_member_directory: true }
      }).save()
      const privateDirectory = await factories.group({
        visibility: Group.Visibility.PUBLIC,
        settings: { public_member_directory: false }
      }).save()
      const member = await factories.user({
        contact_email: 'member@example.com',
        contact_phone: '5551212',
        location: 'Barcelona, Spain',
        bio: 'secret bio',
        facebook_url: 'https://facebook.com/member',
        linkedin_url: 'https://linkedin.com/in/member',
        twitter_name: 'member',
        last_active_at: new Date()
      }).save()
      await publicGroup.addMembers([member.id])
      await privateDirectory.addMembers([member.id])

      const { executionResult } = await handler.inject({
        document: `{
          groups(first: 10) {
            items {
              id
              members(first: 5) {
                items { id name contactEmail contactPhone location bio facebookUrl linkedinUrl twitterName lastActiveAt }
              }
            }
          }
          group(id: "${publicGroup.id}") {
            members(first: 5) {
              items { id name contactEmail contactPhone lastActiveAt }
            }
          }
          privateDirectory: group(slug: "${privateDirectory.get('slug')}") {
            settings { publicMemberDirectory }
            members(first: 5, offset: 0) {
              items { id name contactEmail contactPhone location bio }
            }
          }
        }`,
        serverContext: { req, res }
      })

      expect(executionResult.errors).to.not.be.ok
      const listed = executionResult.data.groups.items.find(item => item.id === String(publicGroup.id))
      expect(listed.members.items).to.deep.equal([])
      expect(executionResult.data.group.members.items).to.deep.equal([])
      expect(executionResult.data.privateDirectory.settings.publicMemberDirectory).to.equal(false)
      expect(executionResult.data.privateDirectory.members.items).to.deep.equal([])
    })

    it('only shows who wrote public posts and comments, not their profile', async () => {
      const author = await factories.user({
        name: 'Public Author',
        tagline: 'hello',
        contact_email: 'author@example.com',
        contact_phone: '5551212',
        location: 'Barcelona, Spain',
        bio: 'secret bio',
        facebook_url: 'https://facebook.com/author',
        linkedin_url: 'https://linkedin.com/in/author',
        twitter_name: 'author',
        url: 'https://author.example.com',
        last_active_at: new Date()
      }).save()
      const authorGroup = await factories.group().save()
      await authorGroup.addMembers([author.id])
      const publicPost = await factories.post({ user_id: author.id, is_public: true }).save()
      await authorGroup.posts().attach(publicPost)
      await factories.comment({ post_id: publicPost.id, user_id: author.id }).save()

      const profileFields = `id name tagline contactEmail contactPhone location bio facebookUrl linkedinUrl twitterName url lastActiveAt
        locationObject { id } memberships { id } membershipsTotal groupRoles { items { id } } skills { items { name } } posts { items { id } }`
      const { executionResult } = await handler.inject({
        document: `{
          post(id: "${publicPost.id}") {
            creator { ${profileFields} }
            comments { items { creator { ${profileFields} } } }
          }
        }`,
        serverContext: { req, res }
      })

      expect(executionResult.errors).to.not.be.ok
      const hiddenProfile = {
        id: String(author.id),
        name: 'Public Author',
        tagline: 'hello',
        contactEmail: null,
        contactPhone: null,
        location: null,
        bio: null,
        facebookUrl: null,
        linkedinUrl: null,
        twitterName: null,
        url: null,
        lastActiveAt: null,
        locationObject: null,
        memberships: [],
        membershipsTotal: 0,
        groupRoles: { items: [] },
        skills: { items: [] },
        posts: { items: [] }
      }
      expect(executionResult.data.post.creator).to.deep.equal(hiddenProfile)
      expect(executionResult.data.post.comments.items[0].creator).to.deep.equal(hiddenProfile)
    })

    it('allows checkInvitation', async () => {
      const { executionResult } = await handler.inject({
        document: `{
          checkInvitation(invitationToken: "foo") {
            valid
          }
        }`,
        serverContext: { req, res }
      })

      return expect(executionResult).to.deep.nested.include({
        data: {
          checkInvitation: {
            valid: false
          }
        }
      })
    })
  })

  describe('querying group data', () => {
    it('works as expected', async () => {
      const { executionResult } = await handler.inject({
        document: `{
          group(id: "${group.id}") {
            slug
            members(first: 2, sortBy: "join") {
              items {
                name
              }
            }
            posts(first: 1, filter: "${Post.Type.REQUEST}") {
              items {
                title
              }
            }
            groupExtensions{
              items{
                type
                data
              }
            }
          }
        }`,
        serverContext: { req, res }
      })

      return expect(executionResult).to.deep.nested.include({
        data: {
          group: {
            slug: group.get('slug'),
            members: {
              items: [
                { name: user2.get('name') },
                { name: user.get('name') }
              ]
            },
            posts: {
              items: [
                { title: post2.get('name') }
              ]
            },
            groupExtensions: {
              items: [
                {
                  type: 'test',
                  data: {
                    'key-test': 'value-test'
                  }
                }
              ]
            }
          }
        }
      })
    })

    it('returns sanitized page content for page views', async () => {
      const view = await GroupView.forge({
        group_id: group.id,
        type: 'page',
        name: 'About',
        page_content: '<p>Hello<img src="x" onerror="alert(1)"></p><script>alert(2)</script>'
      }).save()

      const { executionResult } = await handler.inject({
        document: `{
          group(id: "${group.id}") {
            groupViews(id: "${view.id}") { items { pageContent } }
          }
        }`,
        serverContext: { req, res }
      })

      await view.destroy()
      expect(executionResult.errors).to.be.undefined
      expect(executionResult.data.group.groupViews.items).to.deep.equal([
        { pageContent: '<p>Hello<img src="x"/></p>' }
      ])
    })

    describe('with an invalid sort option', () => {
      it('shows an error', async () => {
        const { executionResult } = await handler.inject({
          document: `{
            group(id: "${group.id}") {
              members(first: 2, sortBy: "height") {
                items {
                  name
                }
              }
            }
          }`,
          serverContext: { req, res }
        })

        return expect(executionResult).to.deep.nested.include({
          'errors[0].message': 'Cannot sort by "height"',
          data: {
            group: {
              members: null
            }
          }
        })
      })
    })
  })

  describe('search', () => {
    beforeEach(async () => {
      await FullTextSearch.dropView()
      await FullTextSearch.createView()
    })

    it('works', async () => {
      // First 4 chars can be an English stop-word prefix (e.g. "withdraw…" → "with") and match nothing in FTS.
      const searchTerm = post.get('name').trim().split(/\s+/)[0].replace(/\\/g, '\\\\').replace(/"/g, '\\"')
      const { executionResult } = await handler.inject({
        document: `{
          search(term: "${searchTerm}", type: "post") {
            items {
              content {
                __typename
                ... on Post {
                  title
                }
              }
            }
          }
        }`,
        serverContext: { req, res }
      })

      return expect(executionResult).to.deep.nested.include({
        data: {
          search: {
            items: [
              {
                content: {
                  __typename: 'Post',
                  title: post.get('name')
                }
              }
            ]
          }
        }
      })
    })
  })

  describe('removeSkill', () => {
    let skill1, skill2

    before(() => {
      const suffix = randomUUID()
      skill1 = factories.skill({ name: `graphql-remove-skill-a-${suffix}` })
      skill2 = factories.skill({ name: `graphql-remove-skill-b-${suffix}` })
      return Promise.join(skill1.save(), skill2.save())
    })

    beforeEach(() => {
      return Promise.join(
        user.skills().detach(skill1),
        user.skills().detach(skill2)
      ).then(() => Promise.join(
        user.skills().attach(skill1),
        user.skills().attach(skill2)
      ))
    })

    it('removes a skill with an id', async () => {
      const { executionResult } = await handler.inject({
        document: `mutation {
          removeSkill(id: ${skill1.id}) {
            success
          }
        }`,
        serverContext: { req, res }
      })

      await user.load('skills')

      expect(executionResult).to.deep.nested.include({
        data: {
          removeSkill: {
            success: true
          }
        }
      })
      expect(user.relations.skills.length).to.equal(1)
      expect(user.relations.skills.first().id).to.equal(skill2.id)
    })

    it('removes a skill with a name', async () => {
      const { executionResult } = await handler.inject({
        document: `mutation {
          removeSkill(name: "${skill2.get('name')}") {
            success
          }
        }`,
        serverContext: { req, res }
      })

      await user.load('skills')

      expect(executionResult).to.deep.nested.include({
        data: {
          removeSkill: {
            success: true
          }
        }
      })
      expect(user.relations.skills.length).to.equal(1)
      expect(user.relations.skills.first().id).to.equal(skill1.id)
    })
  })

  describe('sendEmailVerification', function () {
    it('returns `success: true` if new user', async () => {
      const { executionResult } = await handler.inject({
        document: `
          mutation {
            sendEmailVerification(email: "person@blah.com") {
              success
            }
          }
        `,
        serverContext: { req, res }
      })

      return expect(executionResult).to.deep.nested.include({
        data: {
          sendEmailVerification: {
            success: true
          }
        }
      })
    })

    it('returns `success: true` if existing user with an unverified email', async () => {
      const testUser = await factories.user().save()
      const { executionResult } = await handler.inject({
        document: `
          mutation {
            sendEmailVerification(email: "${testUser.get('email')}") {
              success
            }
          }
        `,
        serverContext: { req, res }
      })

      return expect(executionResult).to.deep.nested.include({
        data: {
          sendEmailVerification: {
            success: true
          }
        }
      })
    })

    it('returns `success: true` if existing user with an already verified email', async () => {
      const testUser = await factories.user({
        email_validated: true
      }).save()

      const { executionResult } = await handler.inject({
        document: `
          mutation {
            sendEmailVerification(email: "${testUser.get('email')}") {
              success
            }
          }
        `,
        serverContext: { req, res }
      })

      return expect(executionResult).to.deep.nested.include({
        data: {
          sendEmailVerification: {
            success: true
          }
        }
      })
    })
  })

  describe('verifyEmail', function () {
    let code, token

    beforeEach(async () => {
      const userVerificationCode = await UserVerificationCode.create(user.get('email'))
      code = userVerificationCode.code
      token = userVerificationCode.token
    })

    it('works', async () => {
      const { executionResult } = await handler.inject({
        document: `
          mutation {
            verifyEmail(code: "${code}", email: "${user.get('email')}") {
              me {
                id
                emailValidated
              }
              error
            }
          }
        `,
        serverContext: { req, res }
      })

      expect(executionResult).to.deep.nested.include({
        data: {
          verifyEmail: {
            me: {
              id: user.id,
              emailValidated: true
            },
            error: null
          }
        }
      })
      // expect(user.get('email_validated')).to.be.true
      expect(req.session.userId).to.equal(user.id)
    })

    it('returns invalid-code error when code is not valid', async () => {
      const { executionResult } = await handler.inject({
        document: `
          mutation {
            verifyEmail(code: "booop", email: "${user.get('email')}") {
              me {
                id
                emailValidated
              }
              error
            }
          }
        `,
        serverContext: { req, res }
      })

      return expect(executionResult).to.deep.nested.include({
        data: {
          verifyEmail: {
            me: null,
            error: 'invalid-code'
          }
        }
      })
    })

    it('returns invalid-link error when token is bad ', async () => {
      const testToken = jwt.sign({
        iss: 'https://hylo.com/moo', // Bad iss here makes bad token
        aud: 'https://hylo.com',
        sub: code,
        exp: Math.floor(Date.now() / 1000) + (60 * 60 * 4), // 4 hour expiration
        code
      }, Buffer.from(process.env.OIDC_KEYS.split(',')[0], 'base64'), { algorithm: 'RS256' })

      const { executionResult } = await handler.inject({
        document: `
          mutation {
            verifyEmail(token: "${testToken}", email: "${user.get('email')}") {
              me {
                id
                emailValidated
              }
              error
            }
          }
        `,
        serverContext: { req, res }
      })

      return expect(executionResult).to.deep.nested.include({
        data: {
          verifyEmail: {
            me: null,
            error: 'invalid-link'
          }
        }
      })
    })

    it('validates email and creates user session on valid token', async () => {
      const { executionResult } = await handler.inject({
        document: `
          mutation {
            verifyEmail(token: "${token}", email: "${user.get('email')}") {
              me {
                id
                emailValidated
              }
            }
          }
        `,
        serverContext: { req, res }
      })

      return expect(executionResult).to.deep.nested.include({
        data: {
          verifyEmail: {
            me: {
              id: user.id,
              emailValidated: true
            }
          }
        }
      })
    })
  })

  describe('makeMutations', () => {
    it('imports mutation functions correctly', () => {
      // this test does not check the correctness of the functions used in
      // mutations; it only checks that they are actually functions (i.e. it fails
      // if there are any broken imports)

      const mutations = makeMutations({ req, res }, 11, false, () => {})
      const root = {}
      const args = {}

      return Promise.each(Object.keys(mutations), key => {
        const fn = mutations[key]
        return Promise.resolve()
          .then(() => fn(root, args))
          .catch(err => {
            if (some(pattern => err.message.match(pattern), [
              /is not a function/,
              /is not defined/
            ])) {
              expect.fail(null, null, `Mutation "${key}" is not imported correctly: ${err.message}`)
            }

          // FIXME: the console.log below shows a number of places where we need
          // more validation and/or are exposing SQL errors to the end-user
          // console.log(`${key}: ${err.message}`)
          })
      })
    })
  })
})

describe('makeAuthenticatedQueries', () => {
  let queries, user

  before(async () => {
    user = await factories.user().save()
    const fetchOne = spy(() => Promise.resolve({}))
    const fetchMany = spy(() => Promise.resolve([]))
    queries = makeAuthenticatedQueries(user.id, fetchOne, fetchMany)
  })

  describe('groupExists', () => {
    it('throws an error if slug is invalid', () => {
      expect(() => {
        queries.groupExists(null, { slug: 'a b' })
      }).to.throw()
    })

    it('returns true if the slug is in use', () => {
      const group = factories.group()
      return group.save()
        .then(() => queries.groupExists(null, { slug: group.get('slug') }))
        .then(result => expect(result.exists).to.be.true)
    })

    it('returns false if the slug is not in use', () => {
      return queries.groupExists(null, { slug: 'sofadogtotherescue' })
        .then(result => expect(result.exists).to.be.false)
    })
  })

  describe('notifications', () => {
    beforeEach(() => spyify(User, 'resetNewNotificationCount'))
    afterEach(() => unspyify(User, 'query'))

    it('resets new notification count if requested', () => {
      return queries.notifications(null, { resetCount: true })
        .then(() => {
          expect(User.resetNewNotificationCount).to.have.been.called.with(user.id)
        })
    })

    it('does not reset new notification count if not requested', () => {
      return queries.notifications(null, {})
        .then(() => {
          expect(User.resetNewNotificationCount).not.to.have.been.called()
        })
    })
  })

  describe('group', () => {
    let group

    beforeEach(async () => {
      group = await factories.group().save()
      await group.addMembers([user])
    })

    afterEach(() => unspyify(GroupMembership, 'updateLastViewedAt'))

    it('updates last viewed time', async () => {
      mockify(GroupMembership, 'updateLastViewedAt', (user, group) => {
        return true
      })
      await queries.group(null, {
        id: group.id,
        updateLastViewed: true
      })
      expect(GroupMembership.updateLastViewedAt).to.have.been.called()
    })

    it('still returns the group when updateLastViewedAt throws', async () => {
      mockify(GroupMembership, 'updateLastViewedAt', () => {
        throw new Error('badge sync failed')
      })
      const result = await queries.group(null, {
        id: group.id,
        updateLastViewed: true
      })
      expect(result).to.exist
    })
  })
})

describe('admin-only relation filters', () => {
  let handler, admin, member, parent, action

  const run = async (userId, document) => {
    const req = factories.mock.request()
    req.url = '/noo/graphql'
    req.method = 'POST'
    req.headers = { 'Content-Type': 'application/json' }
    req.session = { userId, destroy: () => {} }
    const { executionResult } = await handler.inject({ document, serverContext: { req, res: factories.mock.response() } })
    expect(executionResult.errors).to.be.undefined
    return executionResult.data
  }

  before(async () => {
    handler = createRequestHandler()
    admin = await factories.user().save()
    member = await factories.user().save()
    parent = await factories.group().save()
    await admin.joinGroup(parent, { assignAdministrator: true })
    await member.joinGroup(parent)

    action = await factories.post({ type: Post.Type.ACTION, user_id: admin.id }).save()
    await action.groups().attach(parent)
    await factories.postUser({ post_id: action.id, user_id: admin.id, completed_at: new Date(), completion_response: JSON.stringify(['admin']) }).save()
    await factories.postUser({ post_id: action.id, user_id: member.id, completed_at: new Date(), completion_response: JSON.stringify(['member']) }).save()
  })

  const responsesQuery = () => `{ post(id: ${action.id}) { completionResponses { items { user { id } } } } }`

  it('only shows a non-admin their own completion response', async () => {
    const data = await run(member.id, responsesQuery())
    expect(data.post.completionResponses.items.map(i => i.user.id)).to.deep.equal([String(member.id)])
  })

  it('shows admins every completion response', async () => {
    const data = await run(admin.id, responsesQuery())
    expect(data.post.completionResponses.items.map(i => i.user.id)).to.have.members([String(admin.id), String(member.id)])
  })
})

describe('steward-only group data', () => {
  let handler, admin, member, requester, group

  const run = async (userId, document) => {
    const req = factories.mock.request()
    req.url = '/noo/graphql'
    req.method = 'POST'
    req.headers = { 'Content-Type': 'application/json' }
    req.session = { userId, destroy: () => {} }
    const { executionResult } = await handler.inject({ document, serverContext: { req, res: factories.mock.response() } })
    return executionResult
  }

  before(async () => {
    handler = createRequestHandler()
    admin = await factories.user().save()
    member = await factories.user().save()
    requester = await factories.user().save()
    group = await factories.group().save()
    await admin.joinGroup(group, { assignAdministrator: true })
    await member.joinGroup(group)

    await new JoinRequest({ group_id: group.id, user_id: requester.id, status: JoinRequest.STATUS.Pending, created_at: new Date() }).save()
    await Invitation.create({ userId: admin.id, groupId: group.id, email: 'invitee@example.com' })
    await ContentAccess.grantAccess({ userId: member.id, grantedByGroupId: group.id, groupId: group.id, grantedById: admin.id })
  })

  describe('joinRequests', () => {
    const query = () => `{ joinRequests(groupId: ${group.id}) { items { user { id } } } }`

    it('is refused for a member without the Add Members responsibility', async () => {
      const result = await run(member.id, query())
      expect(result.errors[0].message).to.equal('You do not have permission to do that')
    })

    it('is refused without a groupId', async () => {
      const result = await run(admin.id, '{ joinRequests { items { id } } }')
      expect(result.errors[0].message).to.equal('You do not have permission to do that')
    })

    it('returns the requests to a group admin', async () => {
      const result = await run(admin.id, query())
      expect(result.errors).to.be.undefined
      expect(result.data.joinRequests.items.map(i => i.user.id)).to.deep.equal([String(requester.id)])
    })
  })

  describe('Group.pendingInvitations', () => {
    const query = () => `{ group(id: ${group.id}) { pendingInvitations { total items { email } } } }`

    it('is empty for a member without the Add Members responsibility', async () => {
      const result = await run(member.id, query())
      expect(result.errors).to.be.undefined
      expect(result.data.group.pendingInvitations).to.deep.equal({ total: 0, items: [] })
    })

    it('lists invitations for a group admin', async () => {
      const result = await run(admin.id, query())
      expect(result.data.group.pendingInvitations.items.map(i => i.email)).to.deep.equal(['invitee@example.com'])
    })
  })

  describe('contentAccess', () => {
    const rootQuery = groupIds => `{ contentAccess(groupIds: [${groupIds}]) { items { user { id } } } }`

    it('is refused on the root query for a non-admin', async () => {
      const result = await run(member.id, rootQuery(group.id))
      expect(result.errors[0].message).to.equal('You do not have permission to do that')
    })

    it('is refused on the root query without groupIds', async () => {
      const result = await run(admin.id, '{ contentAccess { items { id } } }')
      expect(result.errors[0].message).to.equal('You do not have permission to do that')
    })

    it('returns records on the root query to a group admin', async () => {
      const result = await run(admin.id, rootQuery(group.id))
      expect(result.errors).to.be.undefined
      expect(result.data.contentAccess.items.map(i => i.user.id)).to.deep.equal([String(member.id)])
    })

    it('rejects a sort order that is not asc or desc', async () => {
      const result = await run(admin.id, `{ contentAccess(groupIds: [${group.id}], sortBy: "user_name", order: "asc, (select 1)") { items { id } } }`)
      expect(result.errors[0].message).to.equal('Cannot use sort order "asc, (select 1)"')
    })
  })
})

describe('Group.groupRoles', () => {
  let handler, admin, member, group

  const run = async (userId, document) => {
    const req = factories.mock.request()
    req.url = '/noo/graphql'
    req.method = 'POST'
    req.headers = { 'Content-Type': 'application/json' }
    req.session = { userId, destroy: () => {} }
    const { executionResult } = await handler.inject({ document, serverContext: { req, res: factories.mock.response() } })
    expect(executionResult.errors).to.be.undefined
    return executionResult.data
  }

  before(async () => {
    handler = createRequestHandler()
    admin = await factories.user().save()
    member = await factories.user().save()
    group = await factories.group().save()
    await admin.joinGroup(group, { assignAdministrator: true })
    await member.joinGroup(group)
    await GroupRole.forge({ group_id: group.id, name: 'Greeter', emoji: '👋', type: GroupRole.TYPE_CUSTOM, active: true }).save()
  })

  it('lists system and custom roles but never the implicit Member role', async () => {
    expect(await GroupRole.findMemberRole(group.id)).to.exist

    for (const viewer of [admin, member]) {
      const data = await run(viewer.id, `{ group(id: "${group.id}") { groupRoles { total items { name type } } } }`)
      const roles = data.group.groupRoles
      expect(roles.items.map(role => role.name)).to.have.members(['Administrator', 'Moderator', 'Host', 'Greeter'])
      expect(roles.items.map(role => role.type)).to.not.include(GroupRole.TYPE_MEMBER)
      expect(roles.total).to.equal(4)
    }
  })
})

describe('group invite policy fields', () => {
  let handler, admin, host, member, group, space

  const run = async (userId, document) => {
    const req = factories.mock.request()
    req.url = '/noo/graphql'
    req.method = 'POST'
    req.headers = { 'Content-Type': 'application/json' }
    req.session = { userId, destroy: () => {} }
    const { executionResult } = await handler.inject({ document, serverContext: { req, res: factories.mock.response() } })
    expect(executionResult.errors).to.be.undefined
    return executionResult.data
  }

  const policyQuery = groupId => `{
    group(id: "${groupId}") {
      myInviteAccess
      invitePath
      invitePolicy { mode roleIds }
      memberRole { id name type responsibilities { items { title } } }
    }
  }`

  before(async () => {
    handler = createRequestHandler()
    admin = await factories.user().save()
    host = await factories.user().save()
    member = await factories.user().save()
    group = await factories.group().save()
    space = await factories.group({ type: 'space', parent_id: group.id }).save()
    await admin.joinGroup(group, { assignAdministrator: true })
    await host.joinGroup(group)
    await member.joinGroup(group)
    await member.joinGroup(space)
    const hostRole = await GroupRole.findSystemRole(group.id, 'Host')
    await MemberGroupRole.forge({ user_id: host.id, group_id: group.id, group_role_id: hostRole.id, active: true }).save()
  })

  afterEach(() => GroupRole.setInvitePolicy(group.id, { mode: 'stewards' }))

  it('gives stewards full access and members none when the policy is stewards', async () => {
    expect((await run(admin.id, policyQuery(group.id))).group.myInviteAccess).to.equal('full')
    expect((await run(host.id, policyQuery(group.id))).group.myInviteAccess).to.equal('full')
    expect((await run(member.id, policyQuery(group.id))).group.myInviteAccess).to.be.null
  })

  it('gives members limited access, and no join link, when the policy is everyone', async () => {
    await GroupRole.setInvitePolicy(group.id, { mode: 'everyone' })

    const data = await run(member.id, policyQuery(group.id))
    expect(data.group.myInviteAccess).to.equal('limited')
    expect(data.group.invitePath).to.be.null
    expect((await run(host.id, policyQuery(group.id))).group.myInviteAccess).to.equal('full')
  })

  it('shows the policy and the Member role to Administrators only', async () => {
    await GroupRole.setInvitePolicy(group.id, { mode: 'everyone' })
    const memberRole = await GroupRole.findMemberRole(group.id)

    const data = await run(admin.id, policyQuery(group.id))
    expect(data.group.invitePolicy).to.deep.equal({ mode: 'everyone', roleIds: [] })
    expect(data.group.memberRole).to.deep.equal({
      id: String(memberRole.id),
      name: 'Member',
      type: GroupRole.TYPE_MEMBER,
      responsibilities: { items: [{ title: Responsibility.constants.RESP_INVITE_MEMBERS }] }
    })

    for (const viewer of [host, member]) {
      const hidden = await run(viewer.id, policyQuery(group.id))
      expect(hidden.group.invitePolicy).to.be.null
      expect(hidden.group.memberRole).to.be.null
    }
  })

  it('lists no responsibilities on the Member role outside everyone mode', async () => {
    const moderator = await GroupRole.findSystemRole(group.id, 'Moderator')
    const greeter = await GroupRole.forge({ group_id: group.id, name: 'Greeter', emoji: '🙌', type: GroupRole.TYPE_CUSTOM, active: true }).save()
    await GroupRole.setInvitePolicy(group.id, { mode: 'roles', roleIds: [greeter.id] })

    const data = await run(admin.id, policyQuery(group.id))
    // Specific roles always include the Moderator role
    expect(data.group.invitePolicy).to.deep.equal({ mode: 'roles', roleIds: [String(moderator.id), String(greeter.id)] })
    expect(data.group.memberRole.responsibilities.items).to.deep.equal([])
    await greeter.save({ active: false }, { patch: true })
  })

  it('has no policy or Member role in a space, and no limited access there', async () => {
    await GroupRole.setInvitePolicy(group.id, { mode: 'everyone' })

    const adminView = await run(admin.id, policyQuery(space.id))
    expect(adminView.group.myInviteAccess).to.equal('full')
    expect(adminView.group.invitePolicy).to.be.null
    expect(adminView.group.memberRole).to.be.null

    expect((await run(member.id, policyQuery(space.id))).group.myInviteAccess).to.be.null
  })

  it('tells the viewer whether member invitations are available on this server', async () => {
    const query = '{ me { memberInvitesEnabled } }'
    await withFeatureFlag('MEMBER_INVITES', 'on', async () => {
      expect((await run(member.id, query)).me.memberInvitesEnabled).to.equal(true)
    })
    await withFeatureFlag('MEMBER_INVITES', 'off', async () => {
      expect((await run(member.id, query)).me.memberInvitesEnabled).to.equal(false)
    })
  })

  it('sets the policy through updateGroupSettings and createGroup', async () => {
    const updated = await run(admin.id, `mutation {
      updateGroupSettings(id: "${group.id}", changes: { invitePolicy: { mode: "everyone" } }) {
        invitePolicy { mode roleIds }
      }
    }`)
    expect(updated.updateGroupSettings.invitePolicy).to.deep.equal({ mode: 'everyone', roleIds: [] })

    const slug = `graphql-policy-${Date.now()}`
    const created = await run(admin.id, `mutation {
      createGroup(data: { name: "GraphQL Policy", slug: "${slug}", invitePolicy: { mode: "roles", systemRoleNames: ["Moderator"] } }) {
        id
        invitePolicy { mode roleIds }
      }
    }`)
    // Moderators are stewards, so choosing only them reads as stewards
    expect(created.createGroup.invitePolicy).to.deep.equal({ mode: 'stewards', roleIds: [] })
  })
})

describe('member invitations through GraphQL', () => {
  let handler, admin, member, other, group

  const run = async (userId, document) => {
    const req = factories.mock.request()
    req.url = '/noo/graphql'
    req.method = 'POST'
    req.headers = { 'Content-Type': 'application/json' }
    req.session = { userId, destroy: () => {} }
    const { executionResult } = await handler.inject({ document, serverContext: { req, res: factories.mock.response() } })
    expect(executionResult.errors).to.be.undefined
    return executionResult.data
  }

  const pendingQuery = (first = 20) => `{
    group(id: "${group.id}") {
      myInviteAllowance
      pendingInvitations(first: ${first}) {
        total
        items { email name userId inviterAccess creator { id name } }
      }
    }
  }`

  const submissionsQuery = (first = 20) => `{
    group(id: "${group.id}") {
      myInvitationSubmissions(first: ${first}) {
        total
        hasMore
        items { email person { id } }
      }
    }
  }`

  const invite = (userId, emails) => run(userId, `mutation {
    createInvitation(groupId: "${group.id}", data: { emails: ${JSON.stringify(emails)} }) {
      invitations { id email status error }
    }
  }`)

  before(async () => {
    handler = createRequestHandler()
    mockify(Queue, 'classMethod', () => Promise.resolve())
    admin = await factories.user().save()
    member = await factories.user().save()
    other = await factories.user().save()
    group = await factories.group().save()
    await admin.joinGroup(group, { assignAdministrator: true })
    await member.joinGroup(group)
    await other.joinGroup(group)
    await GroupRole.setInvitePolicy(group.id, { mode: 'everyone' })
  })

  after(() => unspyify(Queue, 'classMethod'))

  it('sends member invitations, counts down the allowance and lists only their own', async () => {
    expect((await run(member.id, pendingQuery())).group).to.deep.equal({
      myInviteAllowance: 25,
      pendingInvitations: { total: 0, items: [] }
    })

    const created = await invite(member.id, ['first@graphql-member.com', other.get('email'), 'nope'])
    expect(created.createInvitation.invitations).to.deep.equal([
      { id: null, email: 'first@graphql-member.com', status: 'sent', error: null },
      { id: null, email: other.get('email').toLowerCase(), status: 'sent', error: null },
      { id: null, email: 'nope', status: null, error: 'invalid' }
    ])
    await invite(member.id, ['second@graphql-member.com'])
    await invite(other.id, ['from-other@graphql-member.com'])

    const memberView = (await run(member.id, pendingQuery())).group
    expect(memberView.myInviteAllowance).to.equal(22)
    // Members see what they submitted, sent or not, instead of pending invitations
    expect(memberView.pendingInvitations).to.deep.equal({ total: 0, items: [] })
    const submissions = (await run(member.id, submissionsQuery())).group.myInvitationSubmissions
    expect(submissions.total).to.equal(3)
    expect(submissions.items.map(item => item.email).sort()).to.deep.equal([
      'first@graphql-member.com', other.get('email').toLowerCase(), 'second@graphql-member.com'
    ].sort())
    expect(submissions.items[0]).to.deep.equal({ email: 'second@graphql-member.com', person: null })
    const firstPage = (await run(member.id, submissionsQuery(1))).group.myInvitationSubmissions
    expect(firstPage.items).to.have.lengthOf(1)
    expect(firstPage.hasMore).to.be.true
  })

  it('shows Add Members holders every invitation with who sent it, and no allowance', async () => {
    await run(admin.id, `mutation {
      createInvitation(groupId: "${group.id}", data: { emails: ["steward@graphql-member.com"] }) { invitations { id } }
    }`)

    const adminView = (await run(admin.id, pendingQuery())).group
    expect(adminView.myInviteAllowance).to.be.null
    const byEmail = Object.fromEntries(adminView.pendingInvitations.items.map(item => [item.email, item]))
    expect(Object.keys(byEmail)).to.have.members([
      'first@graphql-member.com', 'second@graphql-member.com', 'from-other@graphql-member.com', 'steward@graphql-member.com'
    ])
    expect(byEmail['first@graphql-member.com']).to.include({ inviterAccess: 'limited' })
    expect(byEmail['first@graphql-member.com'].creator).to.deep.equal({ id: String(member.id), name: member.get('name') })
    expect(byEmail['steward@graphql-member.com']).to.include({ inviterAccess: 'full' })
    expect(byEmail['steward@graphql-member.com'].creator.id).to.equal(String(admin.id))
    expect((await run(admin.id, pendingQuery(2))).group.pendingInvitations.items).to.have.lengthOf(2)
  })

  it('gives members no list and no allowance under the stewards policy', async () => {
    await GroupRole.setInvitePolicy(group.id, { mode: 'stewards' })
    expect((await run(member.id, pendingQuery())).group).to.deep.equal({
      myInviteAllowance: null,
      pendingInvitations: { total: 0, items: [] }
    })
    expect((await run(member.id, submissionsQuery())).group.myInvitationSubmissions).to.deep.equal({ total: 0, hasMore: false, items: [] })
  })
})

describe('member invitation approval through GraphQL', () => {
  let handler, admin, sponsor, invitee, group

  const run = async (userId, document) => {
    const req = factories.mock.request()
    req.url = '/noo/graphql'
    req.method = 'POST'
    req.headers = { 'Content-Type': 'application/json' }
    req.session = userId ? { userId, destroy: () => {} } : {}
    const { executionResult } = await handler.inject({ document, serverContext: { req, res: factories.mock.response() } })
    return executionResult
  }

  before(async () => {
    handler = createRequestHandler()
    admin = await factories.user().save()
    sponsor = await factories.user({ name: 'Inviting Member', avatar_url: 'https://example.com/inviting-member.png' }).save()
    invitee = await factories.user().save()
    group = await factories.group({ accessibility: Group.Accessibility.RESTRICTED }).save()
    await admin.joinGroup(group, { assignAdministrator: true })
    await sponsor.joinGroup(group)
    await GroupRole.setInvitePolicy(group.id, { mode: 'everyone' })
  })

  it('checks a member invitation, asks for a request, and shows stewards who invited the person', async () => {
    const invitation = await Invitation.create({ userId: sponsor.id, groupId: group.id, email: invitee.get('email'), inviterAccess: Invitation.InviterAccess.LIMITED })
    const token = invitation.get('token')
    const sender = { id: String(sponsor.id), name: 'Inviting Member', avatarUrl: 'https://example.com/inviting-member.png' }

    for (const viewer of [null, invitee.id]) {
      const checked = await run(viewer, `{ checkInvitation(invitationToken: "${token}") { valid groupSlug requiresApproval invitedBy { id name avatarUrl } } }`)
      expect(checked.errors).to.be.undefined
      expect(checked.data.checkInvitation).to.deep.equal({ valid: true, groupSlug: group.get('slug'), requiresApproval: true, invitedBy: sender })
    }

    const used = await run(invitee.id, `mutation { useInvitation(invitationToken: "${token}") { requiresApproval groupSlug error membership { id } } }`)
    expect(used.errors).to.be.undefined
    expect(used.data.useInvitation).to.deep.equal({ requiresApproval: true, groupSlug: group.get('slug'), error: null, membership: null })
    expect(await GroupMembership.forPair(invitee.id, group.id).fetch()).to.not.exist

    const requested = await run(invitee.id, `mutation { createJoinRequest(groupId: "${group.id}", invitationToken: "${token}") { request { id status invitedBy { id name } } } }`)
    expect(requested.errors).to.be.undefined
    expect(requested.data.createJoinRequest.request).to.include({ status: JoinRequest.STATUS.Pending })

    const stewardView = await run(admin.id, `{ joinRequests(groupId: ${group.id}) { items { user { id } invitedBy { id name avatarUrl } } } }`)
    expect(stewardView.errors).to.be.undefined
    expect(stewardView.data.joinRequests.items).to.deep.equal([{ user: { id: String(invitee.id) }, invitedBy: sender }])

    expect(await GroupMembership.inviteAccess(sponsor.id, group.id)).to.equal('limited')
    const sponsorView = await run(sponsor.id, `{ joinRequests(groupId: ${group.id}) { items { id } } }`)
    expect(sponsorView.errors[0].message).to.equal('You do not have permission to do that')
  })

  it('leaves steward invitations as they were', async () => {
    const invitation = await Invitation.create({ userId: admin.id, groupId: group.id, email: 'steward-invitee@approval-graphql.com' })
    const checked = await run(null, `{ checkInvitation(invitationToken: "${invitation.get('token')}") { valid requiresApproval invitedBy { id } } }`)
    expect(checked.data.checkInvitation).to.deep.equal({ valid: true, requiresApproval: false, invitedBy: null })

    const person = await factories.user().save()
    const used = await run(person.id, `mutation { useInvitation(invitationToken: "${invitation.get('token')}") { requiresApproval groupSlug error membership { id } } }`)
    expect(used.errors).to.be.undefined
    expect(used.data.useInvitation.requiresApproval).to.be.null
    expect(used.data.useInvitation.membership.id).to.exist
  })
})
