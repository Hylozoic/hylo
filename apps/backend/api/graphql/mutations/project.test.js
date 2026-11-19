import '../../../test/setup'
import factories from '../../../test/setup/factories'
import {
  createProjectRole, deleteProjectRole, addPeopleToProjectRole,
  joinProject, leaveProject, createStripePaymentNotifications
} from './project'
import mockRequire from 'mock-require'

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
  })

  it('adds a user to a project', async () => {
    await joinProject(project.id, user.id)
    const members = await project.members().fetch()
    expect(members.length).to.equal(1)
    expect(members.first().id).to.equal(user.id)
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
