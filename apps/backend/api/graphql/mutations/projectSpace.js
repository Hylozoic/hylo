import { GraphQLError } from 'graphql'
import { createSpace } from './spaces'
import { placeTaskOnBoards } from '../../models/task/placement'

/** Space setting that records which project post a space was made from. */
export const CONVERTED_FROM_KEY = 'converted_from_project_post_id'

/**
 * The group a project's space is created under: the requested group when the post is in
 * it, otherwise the first group the post is in. A project posted in a space goes under
 * that space's parent, because spaces cannot hold spaces.
 */
async function parentGroupFor (post, groupId) {
  const rows = await bookshelf.knex('groups_posts')
    .join('groups', 'groups.id', 'groups_posts.group_id')
    .where({ 'groups_posts.post_id': post.id, 'groups.active': true })
    .orderBy('groups_posts.id', 'asc')
    .select('groups.id', 'groups.type', 'groups.parent_id')
  const row = groupId
    ? rows.find(r => String(r.id) === String(groupId))
    : rows[0]
  if (!row) return null
  return Group.findActive(row.type === 'space' ? row.parent_id : row.id)
}

/**
 * Turns a legacy project post into a project space.
 *
 * Only the person who created the project can do this, and only where they are allowed to
 * create spaces (Administration on the group). New project posts can no longer be made, so
 * this is how an existing one moves over to a task board.
 *
 * - The post's title is the space's name and its text is the space's description, the
 *   "about" text people see before they join.
 * - The space opens on a Tasks board, with Chat and Members.
 * - The project's members who belong to the group become members of the space.
 * - Posts made under the project are added to the space. Requests among them become tasks
 *   on its board.
 * - The original post stays where it was as a discussion, so its comments, reactions and
 *   link keep working. When there is anything to read (comments, or posts that are not
 *   tasks) the space also gets a Stream view holding it.
 */
export async function convertProjectToSpace (userId, { postId, groupId }, context) {
  if (!userId) throw new GraphQLError('No userId passed into function')
  if (!postId) throw new GraphQLError('No postId passed into function')

  const post = await Post.find(postId)
  if (!post || !post.isProject()) throw new GraphQLError('Project not found')
  if (String(post.get('user_id')) !== String(userId)) {
    throw new GraphQLError('Only the person who created a project can convert it to a space')
  }

  const parent = await parentGroupFor(post, groupId)
  if (!parent || parent.get('type') === 'space') throw new GraphQLError('This project is not in a group that can hold spaces')

  const knex = bookshelf.knex
  const children = await knex('posts')
    .where({ parent_post_id: post.id, active: true })
    .select('id', 'type', 'fulfilled_at')
  const requestIds = children.filter(c => c.type === Post.Type.REQUEST).map(c => c.id)
  const otherChildTypes = [...new Set(children.filter(c => c.type !== Post.Type.REQUEST).map(c => c.type))]
  const hasComments = !!(await knex('comments').where({ post_id: post.id, active: true }).first('id'))
  const hasStream = hasComments || otherChildTypes.length > 0

  const acceptedPostTypes = [Post.Type.TASK]
  if (hasStream) {
    for (const type of [Post.Type.DISCUSSION, ...otherChildTypes]) {
      if (!acceptedPostTypes.includes(type)) acceptedPostTypes.push(type)
    }
  }

  // createSpace checks that this person may create spaces in the group, makes them a
  // member of the new space and puts the space on the group's menu
  const space = await createSpace(userId, {
    parentGroupId: parent.id,
    name: ((post.get('name') || '').trim() || 'Project').slice(0, 255),
    description: post.get('description'),
    icon: 'SquareKanban',
    acceptedPostTypes,
    viewTypes: hasStream ? ['tasks', 'chat', 'all', 'members'] : ['tasks', 'chat', 'members'],
    visibility: Group.Visibility.PROTECTED,
    accessibility: Group.Accessibility.OPEN
  }, context)

  await bookshelf.transaction(async transacting => {
    await space.save({
      settings: { ...(space.get('settings') || {}), [CONVERTED_FROM_KEY]: String(post.id) }
    }, { patch: true, transacting })

    // The project's members, as long as they are still in the group
    const memberRows = await knex('posts_users')
      .transacting(transacting)
      .join('users', 'users.id', 'posts_users.user_id')
      .join('group_memberships', function () {
        this.on('group_memberships.user_id', 'posts_users.user_id')
          .andOn('group_memberships.group_id', knex.raw('?', [parent.id]))
      })
      .where({
        'posts_users.post_id': post.id,
        'posts_users.active': true,
        'users.active': true,
        'group_memberships.active': true
      })
      .whereNotNull('posts_users.project_role_id')
      .whereNot('posts_users.user_id', userId)
      .pluck('posts_users.user_id')
    if (memberRows.length > 0) {
      const now = new Date()
      await space.addMembers(memberRows, { lastReadAt: now }, { transacting })
    }

    if (requestIds.length > 0) {
      await knex.raw(`
        update posts
        set type = 'task',
            task_category = case when fulfilled_at is not null then 'done' else 'todo' end
        where id = any(?)
      `, [requestIds]).transacting(transacting)
    }

    const spacePostIds = children.map(c => c.id)
    if (hasStream) spacePostIds.push(post.id)
    if (spacePostIds.length > 0) {
      await knex('groups_posts').transacting(transacting)
        .insert(spacePostIds.map(id => ({ group_id: space.id, post_id: id })))
    }

    for (const id of requestIds) {
      const task = await Post.find(id, { transacting })
      await placeTaskOnBoards(task, { transacting })
    }

    await post.save({ type: Post.Type.DISCUSSION, updated_at: new Date() }, { patch: true, transacting })
  }).catch(err => {
    throw new GraphQLError(`Converting the project failed: ${err.message}`)
  })

  return space.refresh()
}
