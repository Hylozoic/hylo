/* eslint-disable no-unused-expressions */
import { randomUUID } from 'node:crypto'
import jwt from 'jsonwebtoken'
import { createRequestHandler, makeMutations, makeAuthenticatedQueries } from './index'
import '../../test/setup'
import factories from '../../test/setup/factories'
import { mockify, spyify, unspyify } from '../../test/setup/helpers'
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
