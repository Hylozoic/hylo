/* eslint-disable no-unused-expressions */
import setup from '../../../test/setup'
import factories from '../../../test/setup/factories'
import { assignAdministrator } from '../../../test/setup/roleHelpers'
import { createPost, updatePost } from './post'
import { createSpace } from './spaces'
import {
  assignTask,
  createTaskStatus,
  deleteTaskStatus,
  moveTask,
  unassignTask,
  updateTaskStatus
} from './task'
import { placementsForPost } from '../../models/task/placement'
import { sendTaskDueReminders } from '../../models/task/notifications'
import { createRequestHandler } from '../index'

describe('tasks', () => {
  let steward, member, outsider, group, otherGroup

  const newTask = (userId, attrs = {}) =>
    createPost(userId, { type: 'task', title: `Task ${Math.random()}`, groupIds: [group.id], ...attrs })

  const columns = async groupId => (await TaskStatus.forGroup(groupId))
  const columnNamed = async (groupId, name) => (await columns(groupId)).find(s => s.get('name') === name)
  const placementIn = async (postId, groupId) =>
    (await placementsForPost(postId)).find(p => p.groupId === String(groupId))
  const eventTypes = async (postId, groupId) =>
    (await bookshelf.knex('task_events').where({ post_id: postId, group_id: groupId }).orderBy('id')).map(e => e.type)

  /** The titles of a column's tasks, top to bottom. */
  const columnOrder = async statusId => {
    const rows = await bookshelf.knex('groups_posts')
      .join('posts', 'posts.id', 'groups_posts.post_id')
      .where('task_status_id', statusId)
      .orderBy('task_position')
      .select('posts.name')
    return rows.map(r => r.name)
  }

  before(async () => {
    steward = await factories.user().save()
    member = await factories.user().save()
    outsider = await factories.user().save()
    group = await factories.group().save()
    otherGroup = await factories.group().save()
    await assignAdministrator(steward, group)
    await assignAdministrator(steward, otherGroup)
    await member.joinGroup(group)
  })

  after(() => setup.clearDb())

  describe('creating a task', () => {
    it('seeds the default columns and puts the task at the bottom of the first one', async () => {
      const first = await newTask(steward.id, { title: 'first' })
      const second = await newTask(steward.id, { title: 'second' })

      const statuses = await columns(group.id)
      expect(statuses.map(s => s.get('name'))).to.deep.equal(['To do', 'In progress', 'Ready for review', 'Complete'])
      expect(statuses.map(s => s.get('category'))).to.deep.equal(['todo', 'active', 'active', 'done'])

      const task = await Post.find(first.id)
      expect(task.get('type')).to.equal('task')
      expect(task.get('task_category')).to.equal('todo')
      expect((await placementIn(first.id, group.id)).taskStatusId).to.equal(String(statuses[0].id))
      expect((await columnOrder(statuses[0].id)).slice(-2)).to.deep.equal(['first', 'second'])
      expect(await eventTypes(second.id, group.id)).to.deep.equal(['created'])
    })

    it('starts in the requested column and takes its category', async () => {
      const review = await columnNamed(group.id, 'Ready for review')
      const post = await newTask(member.id, { taskStatusId: review.id })
      const task = await Post.find(post.id)
      expect(task.get('task_category')).to.equal('active')
      expect((await placementIn(post.id, group.id)).taskStatusId).to.equal(String(review.id))
    })

    it('assigns the people passed as members', async () => {
      const post = await newTask(steward.id, { memberIds: [member.id] })
      const members = await (await Post.find(post.id)).members().fetch()
      expect(members.map(m => m.id)).to.deep.equal([member.id])
      expect(await eventTypes(post.id, group.id)).to.deep.equal(['created', 'assigned'])
    })
  })

  describe('moveTask', () => {
    it('lets any group member move a task, and completes it in a done column', async () => {
      const post = await newTask(steward.id)
      const done = await columnNamed(group.id, 'Complete')
      await moveTask(member.id, { postId: post.id, groupId: group.id, taskStatusId: done.id })

      const task = await Post.find(post.id)
      expect(task.get('task_category')).to.equal('done')
      expect(task.get('fulfilled_at')).to.exist
      expect(await eventTypes(post.id, group.id)).to.deep.equal(['created', 'moved', 'completed'])

      const todo = await columnNamed(group.id, 'To do')
      await moveTask(member.id, { postId: post.id, groupId: group.id, taskStatusId: todo.id })
      const reopened = await Post.find(post.id)
      expect(reopened.get('task_category')).to.equal('todo')
      expect(reopened.get('fulfilled_at')).to.not.exist
      expect((await eventTypes(post.id, group.id)).slice(-2)).to.deep.equal(['moved', 'reopened'])
    })

    it('places the task at the given index within the column', async () => {
      const doing = await createTaskStatus(steward.id, { groupId: group.id, name: 'Ordering' })
      const a = await newTask(steward.id, { title: 'a', taskStatusId: doing.id })
      const b = await newTask(steward.id, { title: 'b', taskStatusId: doing.id })
      const c = await newTask(steward.id, { title: 'c', taskStatusId: doing.id })
      expect(await columnOrder(doing.id)).to.deep.equal(['a', 'b', 'c'])

      await moveTask(member.id, { postId: c.id, groupId: group.id, taskStatusId: doing.id, index: 0 })
      expect(await columnOrder(doing.id)).to.deep.equal(['c', 'a', 'b'])

      await moveTask(member.id, { postId: c.id, groupId: group.id, taskStatusId: doing.id, index: 1 })
      expect(await columnOrder(doing.id)).to.deep.equal(['a', 'c', 'b'])

      await moveTask(member.id, { postId: a.id, groupId: group.id, taskStatusId: doing.id })
      expect(await columnOrder(doing.id)).to.deep.equal(['c', 'b', 'a'])
      expect(b.id).to.exist
    })

    it('keeps a cross-posted task in step on its other board', async () => {
      const post = await newTask(steward.id, { groupIds: [group.id, otherGroup.id] })
      const otherColumns = await columns(otherGroup.id)
      expect((await placementIn(post.id, otherGroup.id)).taskStatusId).to.equal(String(otherColumns[0].id))

      // Within a category each board keeps its own column
      const doing = await columnNamed(group.id, 'In progress')
      const review = await columnNamed(group.id, 'Ready for review')
      await moveTask(steward.id, { postId: post.id, groupId: group.id, taskStatusId: doing.id })
      expect((await placementIn(post.id, otherGroup.id)).taskStatusId).to.equal(String(otherColumns[1].id))
      await moveTask(steward.id, { postId: post.id, groupId: group.id, taskStatusId: review.id })
      expect((await placementIn(post.id, otherGroup.id)).taskStatusId).to.equal(String(otherColumns[1].id))

      // Done on one board is done on both
      const done = await columnNamed(group.id, 'Complete')
      await moveTask(steward.id, { postId: post.id, groupId: group.id, taskStatusId: done.id })
      const otherDone = otherColumns.find(s => s.get('category') === 'done')
      expect((await placementIn(post.id, otherGroup.id)).taskStatusId).to.equal(String(otherDone.id))
      expect(await eventTypes(post.id, otherGroup.id)).to.deep.equal(['created', 'completed'])
    })

    it('rejects people outside the task\'s groups, and columns from another board', async () => {
      const post = await newTask(steward.id)
      const done = await columnNamed(group.id, 'Complete')
      const otherDone = (await TaskStatus.ensureForGroup(otherGroup.id)).find(s => s.get('category') === 'done')

      await expect(moveTask(outsider.id, { postId: post.id, groupId: group.id, taskStatusId: done.id }))
        .to.be.rejectedWith(/permission/)
      await expect(moveTask(steward.id, { postId: post.id, groupId: group.id, taskStatusId: otherDone.id }))
        .to.be.rejectedWith(/not on this board/)
    })
  })

  describe('editing', () => {
    it('lets a group member who is not the creator edit a task, and logs it', async () => {
      const post = await newTask(steward.id, { title: 'before' })
      await updatePost(member.id, { id: post.id, data: { title: 'after', groupIds: [group.id] } })
      expect((await Post.find(post.id)).get('name')).to.equal('after')
      const events = await bookshelf.knex('task_events').where({ post_id: post.id, type: 'edited' })
      expect(events.length).to.equal(1)
      expect(events[0].meta.fields).to.include('title')
      expect(String(events[0].actor_id)).to.equal(String(member.id))
    })

    it('does not let an outsider edit a task', async () => {
      const post = await newTask(steward.id)
      await expect(updatePost(outsider.id, { id: post.id, data: { title: 'nope', groupIds: [group.id] } }))
        .to.be.rejectedWith(/permission/)
    })
  })

  describe('assignTask / unassignTask', () => {
    it('lets a member take a task and step off it', async () => {
      const post = await newTask(steward.id)
      await assignTask(member.id, { postId: post.id })
      let members = await (await Post.find(post.id)).members().fetch()
      expect(members.map(m => m.id)).to.deep.equal([member.id])

      await unassignTask(member.id, { postId: post.id })
      members = await (await Post.find(post.id)).members().fetch()
      expect(members.length).to.equal(0)
      expect(await eventTypes(post.id, group.id)).to.deep.equal(['created', 'assigned', 'unassigned'])
    })

    it('only assigns people who belong to one of the task\'s groups', async () => {
      const post = await newTask(steward.id)
      await expect(assignTask(steward.id, { postId: post.id, userId: outsider.id }))
        .to.be.rejectedWith(/Only members of the group/)
    })
  })

  describe('project spaces', () => {
    const projectSpace = (attrs = {}) => createSpace(steward.id, {
      parentGroupId: group.id,
      name: `Project ${Math.random()}`,
      acceptedPostTypes: ['task'],
      viewTypes: ['tasks', 'chat', 'members'],
      accessibility: Group.Accessibility.OPEN,
      ...attrs
    })

    it('starts with the columns given when the space is created, and opens on Tasks', async () => {
      const space = await projectSpace({
        taskStatuses: [
          { name: 'Ideas', category: 'todo' },
          { name: ' Building ' },
          { name: 'Shipped', category: 'done' }
        ]
      })
      const statuses = await columns(space.id)
      expect(statuses.map(s => [s.get('name'), s.get('category'), s.get('order')])).to.deep.equal([
        ['Ideas', 'todo', 0], ['Building', 'active', 1], ['Shipped', 'done', 2]
      ])
      expect(space.get('home_route')).to.match(/tasks/)
    })

    it('refuses starting columns with no done column, and creates no space', async () => {
      const name = `No done ${Math.random()}`
      await expect(projectSpace({ name, taskStatuses: [{ name: 'Only', category: 'todo' }] }))
        .to.be.rejectedWith(/finished tasks/)
      expect(Number(await Group.where({ name }).count())).to.equal(0)
    })

    it('falls back to the default columns when none are given', async () => {
      const space = await projectSpace()
      const statuses = await TaskStatus.ensureForGroup(space.id)
      expect(statuses.map(s => s.get('name'))).to.deep.equal(TaskStatus.DEFAULTS.map(d => d.name))
    })

    it('taking a task in an open project space joins the space', async () => {
      const space = await projectSpace()
      const post = await createPost(steward.id, { type: 'task', title: 'open task', groupIds: [space.id] })
      expect(await GroupMembership.forPair(member.id, space.id).fetch()).to.not.exist

      await assignTask(member.id, { postId: post.id })
      expect(await GroupMembership.forPair(member.id, space.id).fetch()).to.exist
      const members = await (await Post.find(post.id)).members().fetch()
      expect(members.map(m => m.id)).to.deep.equal([member.id])
    })

    it('does not let someone into a space they could not join themselves', async () => {
      const closed = await projectSpace({ accessibility: Group.Accessibility.CLOSED })
      const post = await createPost(steward.id, { type: 'task', title: 'closed task', groupIds: [closed.id] })
      await expect(assignTask(member.id, { postId: post.id })).to.be.rejectedWith(/permission/)
      await expect(assignTask(outsider.id, { postId: post.id })).to.be.rejectedWith(/permission/)
      expect(await GroupMembership.forPair(member.id, closed.id).fetch()).to.not.exist
    })
  })

  describe('notifications', () => {
    const activitiesFor = async (postId, readerId) =>
      (await bookshelf.knex('activities').where({ post_id: postId, reader_id: readerId }).orderBy('id'))

    it('tells someone when another person assigns them, but not when they take a task themselves', async () => {
      const post = await newTask(steward.id)
      await assignTask(steward.id, { postId: post.id, userId: member.id })
      const activities = await activitiesFor(post.id, member.id)
      expect(activities.map(a => a.meta.reasons)).to.deep.equal([['taskAssigned']])
      expect(String(activities[0].actor_id)).to.equal(String(steward.id))

      const own = await newTask(steward.id)
      await assignTask(member.id, { postId: own.id })
      expect(await activitiesFor(own.id, member.id)).to.have.length(0)
    })

    it('tells the creator and assignees about a status change, once for several quick moves', async () => {
      const post = await newTask(steward.id, { memberIds: [member.id] })
      const doing = await columnNamed(group.id, 'In progress')
      const review = await columnNamed(group.id, 'Ready for review')
      const statusChanges = async readerId =>
        (await activitiesFor(post.id, readerId)).filter(a => a.meta.reasons.includes('taskStatusChanged'))

      // The steward (creator) moves it: only the assignee hears about it
      await moveTask(steward.id, { postId: post.id, groupId: group.id, taskStatusId: doing.id })
      expect(await statusChanges(steward.id)).to.have.length(0)
      expect((await statusChanges(member.id)).map(a => a.meta.statusName)).to.deep.equal(['In progress'])

      // A second move straight after updates that notification rather than adding one
      await moveTask(steward.id, { postId: post.id, groupId: group.id, taskStatusId: review.id })
      expect((await statusChanges(member.id)).map(a => a.meta.statusName)).to.deep.equal(['Ready for review'])

      // The assignee moves it: the creator hears about it
      await moveTask(member.id, { postId: post.id, groupId: group.id, taskStatusId: doing.id })
      expect((await statusChanges(steward.id)).map(a => a.meta.statusName)).to.deep.equal(['In progress'])
    })

    it('reminds assignees the day before and on the day a task is due, once each', async () => {
      const now = new Date('2026-11-20T15:00:00Z') // 3pm UTC
      const dueTomorrow = await newTask(steward.id, { title: 'due tomorrow', memberIds: [member.id], endTime: new Date('2026-11-21T17:00:00Z').getTime(), timezone: 'UTC' })
      const dueNextWeek = await newTask(steward.id, { title: 'due later', memberIds: [member.id], endTime: new Date('2026-11-27T17:00:00Z').getTime(), timezone: 'UTC' })
      const dueReasons = async postId =>
        (await activitiesFor(postId, member.id)).filter(a => a.meta.reasons.includes('taskDueSoon')).map(a => a.meta.when)

      await sendTaskDueReminders(now)
      await sendTaskDueReminders(now)
      expect(await dueReasons(dueTomorrow.id)).to.deep.equal(['tomorrow'])
      expect(await dueReasons(dueNextWeek.id)).to.deep.equal([])

      // Before 8am on the due day nothing goes out; later that day the "today" reminder does
      await sendTaskDueReminders(new Date('2026-11-21T06:00:00Z'))
      expect(await dueReasons(dueTomorrow.id)).to.deep.equal(['tomorrow'])
      await sendTaskDueReminders(new Date('2026-11-21T09:00:00Z'))
      expect(await dueReasons(dueTomorrow.id)).to.deep.equal(['tomorrow', 'today'])

      // Completed tasks are not reminded about
      const done = await columnNamed(group.id, 'Complete')
      const finished = await newTask(steward.id, { memberIds: [member.id], endTime: new Date('2026-11-21T17:00:00Z').getTime(), timezone: 'UTC' })
      await moveTask(steward.id, { postId: finished.id, groupId: group.id, taskStatusId: done.id })
      await sendTaskDueReminders(now)
      expect(await dueReasons(finished.id)).to.deep.equal([])
    })
  })

  describe('through GraphQL', () => {
    it('moves a task and returns its board placement and the group\'s columns', async () => {
      const post = await newTask(steward.id, { title: 'via graphql' })
      const done = await columnNamed(group.id, 'Complete')
      const req = factories.mock.request()
      req.url = '/noo/graphql'
      req.method = 'POST'
      req.headers = { 'Content-Type': 'application/json' }
      req.session = { userId: member.id, destroy: () => {} }
      req.user = member

      const { executionResult } = await createRequestHandler().inject({
        document: `mutation {
          moveTask(postId: "${post.id}", groupId: "${group.id}", taskStatusId: "${done.id}", index: 0) {
            id
            type
            taskCategory
            fulfilledAt
            canEdit
            taskPlacements { groupId taskStatusId position }
            groups { id taskStatuses { id name category order } }
          }
        }`,
        serverContext: { req, res: factories.mock.response() }
      })

      expect(executionResult.errors).to.not.exist
      const task = executionResult.data.moveTask
      expect(task.type).to.equal('task')
      expect(task.taskCategory).to.equal('done')
      expect(task.fulfilledAt).to.exist
      expect(task.canEdit).to.equal(true)
      expect(task.taskPlacements).to.have.length(1)
      expect(task.taskPlacements[0]).to.include({ groupId: String(group.id), taskStatusId: String(done.id) })
      const { executionResult: events } = await createRequestHandler().inject({
        document: `{ group(id: "${group.id}") { taskEvents { type meta actor { id name } post { id title } } } }`,
        serverContext: { req, res: factories.mock.response() }
      })
      expect(events.errors).to.not.exist
      const mine = events.data.group.taskEvents.filter(e => e.post.id === String(post.id))
      expect(mine.map(e => e.type)).to.deep.equal(['created', 'moved', 'completed'])
      expect(mine[1].meta.toStatusName).to.equal('Complete')
      expect(mine[1].actor.id).to.equal(String(member.id))

      // The board: each column with its tasks in order, and a "my tasks" filter
      const ordering = await createTaskStatus(steward.id, { groupId: group.id, name: 'Board order' })
      const one = await newTask(steward.id, { title: 'board one', taskStatusId: ordering.id })
      const two = await newTask(steward.id, { title: 'board two', taskStatusId: ordering.id, memberIds: [member.id] })
      await moveTask(steward.id, { postId: two.id, groupId: group.id, taskStatusId: ordering.id, index: 0 })
      const { executionResult: board } = await createRequestHandler().inject({
        document: `{ group(id: "${group.id}") { taskStatuses {
          id tasksTotal tasks { id title } mine: tasks(assigneeId: "${member.id}") { title } mineTotal: tasksTotal(assigneeId: "${member.id}")
        } } }`,
        serverContext: { req, res: factories.mock.response() }
      })
      expect(board.errors).to.not.exist
      const column = board.data.group.taskStatuses.find(s => s.id === String(ordering.id))
      expect(column.tasks.map(t => t.title)).to.deep.equal(['board two', 'board one'])
      expect(column.tasksTotal).to.equal(2)
      expect(column.mine.map(t => t.title)).to.deep.equal(['board two'])
      expect(column.mineTotal).to.equal(1)
      expect(one.id).to.exist

      const statuses = task.groups[0].taskStatuses
      expect(statuses.map(s => s.category)).to.include.members(['todo', 'active', 'done'])
      expect(statuses.map(s => s.order)).to.deep.equal(statuses.map((s, i) => i))
    })
  })

  describe('columns', () => {
    let board

    before(async () => {
      board = await factories.group().save()
      await assignAdministrator(steward, board)
      await member.joinGroup(board)
    })

    const names = async () => (await columns(board.id)).map(s => s.get('name'))

    it('only lets people who manage content change columns', async () => {
      await expect(createTaskStatus(member.id, { groupId: board.id, name: 'Nope' }))
        .to.be.rejectedWith(/permission/)
    })

    it('adds a column before the first done column', async () => {
      await createTaskStatus(steward.id, { groupId: board.id, name: 'Blocked' })
      expect(await names()).to.deep.equal(['To do', 'In progress', 'Ready for review', 'Blocked', 'Complete'])
    })

    it('renames and reorders a column', async () => {
      const blocked = await columnNamed(board.id, 'Blocked')
      await updateTaskStatus(steward.id, { id: blocked.id, name: 'Waiting', order: 1 })
      expect(await names()).to.deep.equal(['To do', 'Waiting', 'In progress', 'Ready for review', 'Complete'])
      expect((await columns(board.id)).map(s => s.get('order'))).to.deep.equal([0, 1, 2, 3, 4])
    })

    it('keeps at least one done column', async () => {
      const done = await columnNamed(board.id, 'Complete')
      await expect(deleteTaskStatus(steward.id, { id: done.id })).to.be.rejectedWith(/completed tasks/)
      await expect(updateTaskStatus(steward.id, { id: done.id, category: 'active' })).to.be.rejectedWith(/completed tasks/)
    })

    it('re-categorising a column updates the tasks in it', async () => {
      const waiting = await columnNamed(board.id, 'Waiting')
      const post = await createPost(steward.id, { type: 'task', title: 'shipped', groupIds: [board.id], taskStatusId: waiting.id })
      await updateTaskStatus(steward.id, { id: waiting.id, category: 'done' })
      const task = await Post.find(post.id)
      expect(task.get('task_category')).to.equal('done')
      expect(task.get('fulfilled_at')).to.exist
    })

    it('deleting a column moves its tasks to the first column', async () => {
      const waiting = await columnNamed(board.id, 'Waiting')
      const todo = await columnNamed(board.id, 'To do')
      await deleteTaskStatus(steward.id, { id: waiting.id })

      expect(await names()).to.deep.equal(['To do', 'In progress', 'Ready for review', 'Complete'])
      expect(await columnOrder(todo.id)).to.deep.equal(['shipped'])
      const task = await Post.where({ name: 'shipped' }).fetch()
      expect(task.get('task_category')).to.equal('todo')
      expect(task.get('fulfilled_at')).to.not.exist
    })
  })
})
