/* eslint-disable no-unused-expressions */
import setup from '../../../test/setup'
import factories from '../../../test/setup/factories'
import { assignAdministrator } from '../../../test/setup/roleHelpers'
import { convertProjectToSpace, CONVERTED_FROM_KEY } from './projectSpace'

describe('convertProjectToSpace', () => {
  let knex, creator, member, outsider, steward, group

  const postType = async id => (await knex('posts').where({ id }).first('type')).type
  const viewTypes = async groupId =>
    (await knex('group_views').where({ group_id: groupId }).orderBy('order')).map(v => v.type)

  const newPost = async (attrs, groupIds = [group.id]) => {
    const post = await factories.post({ user_id: creator.id, ...attrs }).save()
    for (const groupId of groupIds) {
      await knex('groups_posts').insert({ group_id: groupId, post_id: post.id })
    }
    return post
  }

  const expectRejected = async (promise, message) => {
    let error
    try {
      await promise
    } catch (e) {
      error = e
    }
    expect(error, 'expected the call to be rejected').to.exist
    expect(error.message).to.contain(message)
  }

  before(async () => {
    knex = bookshelf.knex
    creator = await factories.user().save()
    member = await factories.user().save()
    outsider = await factories.user().save()
    steward = await factories.user().save()
    group = await factories.group({ slug: 'garden' }).save()
    await assignAdministrator(creator, group)
    await assignAdministrator(steward, group)
    await member.joinGroup(group)
  })

  after(() => setup.clearDb())

  describe('a project with members, comments and child posts', () => {
    let project, request, doneRequest, offer, space

    before(async () => {
      project = await newPost({ type: 'project', name: 'Plant the Orchard!', description: '<p>About the orchard</p>' })
      await project.addPostMembers([member.id, outsider.id])
      await factories.comment({ post_id: project.id, user_id: member.id }).save()
      request = await newPost({ type: 'request', name: 'Bring shovels', parent_post_id: project.id })
      doneRequest = await newPost({ type: 'request', name: 'Order saplings', parent_post_id: project.id, fulfilled_at: new Date() })
      offer = await newPost({ type: 'offer', name: 'Spare saplings', parent_post_id: project.id })

      space = await convertProjectToSpace(creator.id, { postId: project.id }, {})
    })

    it('makes a space under the group, named and described by the post', async () => {
      expect(space.get('type')).to.equal('space')
      expect(String(space.get('parent_id'))).to.equal(String(group.id))
      expect(space.get('name')).to.equal('Plant the Orchard!')
      expect(space.get('slug')).to.equal('garden-plant-the-orchard')
      expect(space.get('description')).to.equal('<p>About the orchard</p>')
      expect(space.get('home_route')).to.equal('/tasks')
      expect(space.get('settings')[CONVERTED_FROM_KEY]).to.equal(String(project.id))
    })

    it('puts the space on the group menu', async () => {
      const entry = await knex('group_views')
        .where({ group_id: group.id, type: 'space', linked_group_id: space.id }).first()
      expect(entry.order).to.not.be.null
    })

    it('keeps the original post as a discussion', async () => {
      expect(await postType(project.id)).to.equal('discussion')
      expect(await knex('groups_posts').where({ group_id: group.id, post_id: project.id }).first()).to.exist
    })

    it('adds the creator and the members who are in the group, and nobody else', async () => {
      const rows = await knex('group_memberships').where({ group_id: space.id, active: true })
      expect(rows.map(r => String(r.user_id)).sort()).to.deep.equal([creator.id, member.id].map(String).sort())
    })

    it('turns requests made under the project into tasks on the board', async () => {
      const category = async postId => (await knex('groups_posts')
        .join('task_statuses', 'task_statuses.id', 'groups_posts.task_status_id')
        .where({ 'groups_posts.group_id': space.id, post_id: postId })
        .first('task_statuses.category')).category

      expect(await postType(request.id)).to.equal('task')
      expect(await category(request.id)).to.equal('todo')
      expect(await postType(doneRequest.id)).to.equal('task')
      expect(await category(doneRequest.id)).to.equal('done')
    })

    it('adds a stream holding the other posts and the original', async () => {
      expect(await viewTypes(space.id)).to.deep.equal(['tasks', 'chat', 'all', 'members'])
      expect(await postType(offer.id)).to.equal('offer')
      const inSpace = await knex('groups_posts').where({ group_id: space.id }).pluck('post_id')
      expect(inSpace.map(String).sort())
        .to.deep.equal([project.id, request.id, doneRequest.id, offer.id].map(String).sort())
      expect(space.get('accepted_post_types')).to.deep.equal(['task', 'discussion', 'offer'])
    })

    it('cannot be converted twice', async () => {
      await expectRejected(convertProjectToSpace(creator.id, { postId: project.id }, {}), 'Project not found')
    })
  })

  it('gives a project with nothing to read just a board, chat and members', async () => {
    const project = await newPost({ type: 'project', name: 'Build the shed' })
    const space = await convertProjectToSpace(creator.id, { postId: project.id, groupId: group.id }, {})
    expect(await viewTypes(space.id)).to.deep.equal(['tasks', 'chat', 'members'])
    expect(await knex('groups_posts').where({ group_id: space.id })).to.have.length(0)
  })

  it('puts a project posted in a space under that space\'s group', async () => {
    const project = await newPost({ type: 'project', name: 'Nested one' }, [])
    const holder = await factories.group({ type: 'space', parent_id: group.id, slug: 'garden-holder' }).save()
    await knex('groups_posts').insert({ group_id: holder.id, post_id: project.id })
    const space = await convertProjectToSpace(creator.id, { postId: project.id }, {})
    expect(String(space.get('parent_id'))).to.equal(String(group.id))
  })

  it('is only for the person who created the project', async () => {
    const project = await newPost({ type: 'project', name: 'Not yours' })
    await expectRejected(
      convertProjectToSpace(steward.id, { postId: project.id }, {}),
      'Only the person who created a project'
    )
    expect(await postType(project.id)).to.equal('project')
  })

  it('needs permission to create spaces in the group', async () => {
    const project = await factories.post({ user_id: member.id, type: 'project', name: 'By a member' }).save()
    await knex('groups_posts').insert({ group_id: group.id, post_id: project.id })
    await expectRejected(
      convertProjectToSpace(member.id, { postId: project.id }, {}),
      "You don't have permission to create spaces"
    )
    expect(await postType(project.id)).to.equal('project')
    expect(await knex('groups').whereRaw(`settings ->> '${CONVERTED_FROM_KEY}' = ?`, [String(project.id)]).first()).to.not.exist
  })

  it('refuses posts that are not projects, and projects in no group', async () => {
    const discussion = await newPost({ type: 'discussion', name: 'Just talk' })
    await expectRejected(convertProjectToSpace(creator.id, { postId: discussion.id }, {}), 'Project not found')
    const groupless = await newPost({ type: 'project', name: 'No home' }, [])
    await expectRejected(convertProjectToSpace(creator.id, { postId: groupless.id }, {}), 'not in a group')
  })
})
