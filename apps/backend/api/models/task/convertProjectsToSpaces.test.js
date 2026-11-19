/* eslint-disable no-unused-expressions */
import setup from '../../../test/setup'
import factories from '../../../test/setup/factories'

const migration = require('../../../migrations/20261117130000_convert_projects_to_spaces')

describe('converting project posts to project spaces', () => {
  let knex, creator, member, outsider, group
  let project, request, offer, finished, groupless

  const spaceFor = postId =>
    knex('groups').whereRaw("settings ->> 'converted_from_project_post_id' = ?", [String(postId)]).first()
  const postType = async id => (await knex('posts').where({ id }).first('type')).type
  const viewTypes = async groupId =>
    (await knex('group_views').where({ group_id: groupId }).orderBy('order')).map(v => v.type)
  const menuEntry = (parentId, spaceId) =>
    knex('group_views').where({ group_id: parentId, type: 'space', linked_group_id: spaceId }).first()

  const newPost = async (attrs, groupIds = [group.id]) => {
    const post = await factories.post({ user_id: creator.id, ...attrs }).save()
    for (const groupId of groupIds) {
      await knex('groups_posts').insert({ group_id: groupId, post_id: post.id })
    }
    return post
  }

  before(async () => {
    knex = bookshelf.knex
    creator = await factories.user().save()
    member = await factories.user().save()
    outsider = await factories.user().save()
    group = await factories.group({ slug: 'garden' }).save()
    await creator.joinGroup(group)
    await member.joinGroup(group)

    project = await newPost({ type: 'project', name: 'Plant the Orchard!', description: '<p>About the orchard</p>' })
    await project.addProjectMembers([member.id, outsider.id])
    await factories.comment({ post_id: project.id, user_id: member.id }).save()
    request = await newPost({ type: 'request', name: 'Bring shovels', parent_post_id: project.id })
    offer = await newPost({ type: 'offer', name: 'Spare saplings', parent_post_id: project.id })

    finished = await newPost({ type: 'project', name: 'Build the shed', fulfilled_at: new Date() })
    groupless = await newPost({ type: 'project', name: 'No home' }, [])

    await migration.up(knex)
  })

  after(() => setup.clearDb())

  it('makes a space under the group, named and described by the post', async () => {
    const space = await spaceFor(project.id)
    expect(space.type).to.equal('space')
    expect(String(space.parent_id)).to.equal(String(group.id))
    expect(space.name).to.equal('Plant the Orchard!')
    expect(space.slug).to.equal('garden-plant-the-orchard')
    expect(space.description).to.equal('<p>About the orchard</p>')
    expect(space.home_route).to.equal('/tasks')
    expect(space.active).to.be.true
    expect(String(space.created_by_id)).to.equal(String(creator.id))
  })

  it('keeps the original post as a discussion', async () => {
    expect(await postType(project.id)).to.equal('discussion')
    expect(await knex('groups_posts').where({ group_id: group.id, post_id: project.id }).first()).to.exist
  })

  it('adds the creator and the members who are in the group, and nobody else', async () => {
    const space = await spaceFor(project.id)
    const rows = await knex('group_memberships').where({ group_id: space.id, active: true })
    expect(rows.map(r => String(r.user_id)).sort()).to.deep.equal([creator.id, member.id].map(String).sort())
    expect(space.num_members).to.equal(2)
  })

  it('gives the space a board with the default columns', async () => {
    const space = await spaceFor(project.id)
    const statuses = await knex('task_statuses').where({ group_id: space.id }).orderBy('order')
    expect(statuses.map(s => s.name)).to.deep.equal(['To do', 'In progress', 'Ready for review', 'Complete'])
  })

  it('turns requests made under the project into tasks on the board', async () => {
    const space = await spaceFor(project.id)
    expect(await postType(request.id)).to.equal('task')
    const placement = await knex('groups_posts')
      .join('task_statuses', 'task_statuses.id', 'groups_posts.task_status_id')
      .where({ 'groups_posts.group_id': space.id, post_id: request.id })
      .first('task_statuses.category')
    expect(placement.category).to.equal('todo')
  })

  it('adds a stream holding the other posts and the original when there is something to read', async () => {
    const space = await spaceFor(project.id)
    expect(await viewTypes(space.id)).to.deep.equal(['tasks', 'chat', 'all', 'members'])
    expect(await postType(offer.id)).to.equal('offer')
    const inSpace = await knex('groups_posts').where({ group_id: space.id }).pluck('post_id')
    expect(inSpace.map(String).sort()).to.deep.equal([project.id, request.id, offer.id].map(String).sort())
    expect(space.accepted_post_types).to.deep.equal(['task', 'discussion', 'offer'])
  })

  it('puts an open project on the group menu and a finished one in More Spaces', async () => {
    const open = await spaceFor(project.id)
    const done = await spaceFor(finished.id)
    expect((await menuEntry(group.id, open.id)).order).to.not.be.null
    expect((await menuEntry(group.id, done.id)).order).to.be.null
    expect(await viewTypes(done.id)).to.deep.equal(['tasks', 'chat', 'members'])
    const parent = await knex('groups').where({ id: group.id }).first()
    expect(parent.more_spaces_count).to.equal(1)
  })

  it('makes a project with no group a plain task', async () => {
    expect(await spaceFor(groupless.id)).to.not.exist
    expect(await postType(groupless.id)).to.equal('task')
  })

  it('can be undone', async () => {
    const space = await spaceFor(project.id)
    await migration.down(knex)

    expect(await postType(project.id)).to.equal('project')
    expect(await postType(finished.id)).to.equal('project')
    expect(await postType(groupless.id)).to.equal('project')
    expect(await postType(request.id)).to.equal('request')
    expect((await knex('groups').where({ id: space.id }).first()).active).to.be.false
    expect(await menuEntry(group.id, space.id)).to.not.exist
    expect(await knex('groups_posts').where({ group_id: space.id })).to.have.length(0)
  })
})
