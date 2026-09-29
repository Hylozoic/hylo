import '../../../test/setup'
import factories from '../../../test/setup/factories'
import {
  createProject, createProjectRole, deleteProjectRole, addPeopleToProjectRole,
  joinProject, leaveProject, createStripePaymentNotifications
} from './project'
import mockRequire from 'mock-require'

describe('createProject', () => {
  var user, user2, group

  before(function () {
    user = factories.user()
    user2 = factories.user()
    group = factories.group()
    return Promise.join(group.save(), user.save(), user2.save())
    .then(() => user.joinGroup(group))
  })

  it('creates a post with project type, adding members and creator as member', async () => {
    const data = {
      title: 'abc',
      groupIds: [group.id],
      memberIds: [user2.id]
    }
    const post = await createProject(user.id, data)
    const project = await Post.find(post.id)
    expect(project.get('type')).to.equal(Post.Type.PROJECT)
    const members = await project.members().fetch()
    expect(members.length).to.equal(2)
    expect(members.map(m => m.id).sort()).to.deep.equal([user.id, user2.id].sort())
  })
})

describe('createProjectRole', () => {
  var user, project

  before(async function () {
    user = factories.user()
    await user.save()
    project = factories.post({type: Post.Type.PROJECT, user_id: user.id})
    await project.save()
  })

  it('creates a project role', async () => {
    const roleName = 'Founder'
    await createProjectRole(user.id, project.id, roleName)
    const projectRole = await ProjectRole.where({name: roleName}).fetch()
    expect(projectRole).to.exist
    expect(projectRole.get('post_id')).to.equal(project.id)
  })
})

describe('deleteProjectRole', () => {
  var user, project, projectRole

  before(async function () {
    user = factories.user()
    await user.save()
    project = factories.post({type: Post.Type.PROJECT, user_id: user.id})
    await project.save()
    projectRole = new ProjectRole({post_id: project.id, name: 'Founder'})
    await projectRole.save()
  })

  it('creates a project role', async () => {
    await deleteProjectRole(user.id, projectRole.id)
    const fetchedProjectRole = await ProjectRole.find(projectRole.id)
    expect(fetchedProjectRole).not.to.exist
  })
})

describe.skip('addPeopleToProjectRole', () => {
  var user, user2, group, projectRole, project

  before(async function () {
    user = factories.user()
    await user.save()
    user2 = factories.user()
    await user2.save()
    group = factories.group()
    await group.save()
    await user.joinGroup(group)
    await user2.joinGroup(group)
    project = factories.post({type: Post.Type.PROJECT, user_id: user.id})
    await project.save()
    projectRole = new ProjectRole({post_id: project.id, name: 'Founder'})
    await projectRole.save()
  })

  it('sets the group memberships to the user ids', async () => {
    await addPeopleToProjectRole(user.id, [user2.id], projectRole.id)
    const gm = await GroupMembership.forPair(user2.id, project).fetch()
    expect(gm.get('project_role_id')).to.equal(projectRole.id)
  })
})

describe('joinProject', () => {
  var user, project

  before(async function () {
    user = factories.user()
    await user.save()
    project = factories.post({type: Post.Type.PROJECT})
    await project.save()
    const group = await factories.group().save()
    await group.addMembers([user])
    await group.posts().attach(project)
  })

  it('adds a user to a project', async () => {
    await joinProject(project.id, user.id)
    const members = await project.members().fetch()
    expect(members.length).to.equal(1)
    expect(members.first().id).to.equal(user.id)
  })
})

describe('joinProject notice to the creator (D57)', () => {
  let creator, joiner, group, project

  const joinedActivities = async () => (await Activity.query(q => {
    q.where({ post_id: project.id })
    q.whereRaw("meta->'reasons' \\? 'projectJoined'")
  }).fetchAll()).models

  before(async () => {
    creator = await factories.user().save()
    joiner = await factories.user().save()
    group = await factories.group().save()
    await group.addMembers([creator, joiner])
    project = await factories.post({ type: Post.Type.PROJECT, user_id: creator.id }).save()
    await group.posts().attach(project)
  })

  it('notifies the creator once, in-app and by push', async () => {
    await joinProject(project.id, joiner.id)
    await joinProject(project.id, joiner.id)

    const activities = await joinedActivities()
    expect(activities.length).to.equal(1)
    expect(String(activities[0].get('reader_id'))).to.equal(String(creator.id))
    expect(String(activities[0].get('actor_id'))).to.equal(String(joiner.id))
    const media = (await Notification.where({ activity_id: activities[0].id }).fetchAll()).pluck('medium').sort()
    expect(media).to.deep.equal([Notification.MEDIUM.InApp, Notification.MEDIUM.Push])
  })

  it('does not notify the creator about their own join', async () => {
    await bookshelf.knex('notifications').del()
    await bookshelf.knex('activities').where({ post_id: project.id }).del()
    await joinProject(project.id, creator.id)
    expect(await joinedActivities()).to.have.length(0)
  })

  it('notifies once per person, however often they leave and join again', async () => {
    const other = await factories.user().save()
    await group.addMembers([other])
    await bookshelf.knex('notifications').del()
    await bookshelf.knex('activities').where({ post_id: project.id }).del()

    for (let i = 0; i < 3; i++) {
      await joinProject(project.id, other.id)
      await leaveProject(project.id, other.id)
    }
    const activities = await joinedActivities()
    expect(activities.map(a => String(a.get('actor_id')))).to.deep.equal([String(other.id)])
  })

  it('only joins projects the person can see', async () => {
    const outsider = await factories.user().save()
    await expect(joinProject(project.id, outsider.id)).to.be.rejectedWith(/Project not found/)
    expect(await project.isProjectMember(outsider.id)).to.be.false

    const discussion = await factories.post({ type: 'discussion', user_id: creator.id }).save()
    await group.posts().attach(discussion)
    await expect(joinProject(discussion.id, joiner.id)).to.be.rejectedWith(/Project not found/)
    expect((await Activity.where({ post_id: discussion.id }).fetchAll()).length).to.equal(0)
  })
})

describe('leaveProject', () => {
  var user, project

  before(async function () {
    user = factories.user()
    await user.save()
    project = factories.post({type: Post.Type.PROJECT})
    await project.save()
    await project.addProjectMembers([user.id])
  })

  it('removes a user from a project', async () => {
    await leaveProject(project.id, user.id)
    const members = await project.members().fetch()
    expect(members.length).to.equal(0)
  })
})
