// Turns each project post into a project space, and Projects views into Tasks views.
//
// For every active project post that sits in a group:
// - A space is created under that group (the first group the post is in; when that group is
//   itself a space, its parent). The post's title is the space's name and the post's text is
//   its description, which is the "about" text people see before they join.
// - The space opens on a Tasks board with the four default columns, plus Chat and Members.
// - The project's members who belong to the parent group become members of the space.
// - Posts made under the project are added to the space. Requests among them become tasks
//   on its board.
// - The original post stays where it was as a discussion, so its comments, reactions and
//   link keep working. When there is anything to read (comments, or posts that are not
//   tasks) the space also gets a Stream view and the original post is added to it.
// - Up to MENU_LIMIT open projects per group go on the group's menu, most recently updated
//   first. The rest, and completed projects, go to More Spaces.
//
// Project posts with no usable group, and inactive ones, become plain tasks.
//
// Every created space records the post it came from in settings.converted_from_project_post_id,
// which is what `down` uses to remove the spaces and restore the posts.

const crypto = require('crypto')

const GAP = 1024
const MENU_LIMIT = 5
const SOURCE_KEY = 'converted_from_project_post_id'

const VISIBILITY_PROTECTED = 1
const ACCESSIBILITY_OPEN = 2

const DEFAULT_COLUMNS = [
  { name: 'To do', category: 'todo', order: 0 },
  { name: 'In progress', category: 'active', order: 1 },
  { name: 'Ready for review', category: 'active', order: 2 },
  { name: 'Complete', category: 'done', order: 3 }
]

const CODE_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'

function slugify (name) {
  return (name || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40) || 'project'
}

async function uniqueSlug (knex, baseSlug) {
  let slug = baseSlug
  let suffix = 2
  while (await knex('groups').where({ slug }).first('id')) {
    slug = `${baseSlug}-${suffix}`
    suffix += 1
  }
  return slug
}

function randomCode () {
  const bytes = crypto.randomBytes(10)
  let code = ''
  for (let i = 0; i < 10; i++) code += CODE_CHARS[bytes[i] % CODE_CHARS.length]
  return code
}

async function uniqueAccessCode (knex) {
  for (;;) {
    const code = randomCode()
    const inGroups = await knex('groups').whereRaw('lower(access_code) = lower(?)', [code]).first('id')
    const inLinks = await knex('group_invite_links').whereRaw('lower(access_code) = lower(?)', [code]).first('id')
    if (!inGroups && !inLinks) return code
  }
}

function membershipSettings (now) {
  return JSON.stringify({
    postNotifications: 'all',
    digestFrequency: 'daily',
    sendEmail: true,
    sendPushNotifications: true,
    lastReadAt: now,
    showJoinForm: false,
    agreementsAcceptedAt: now,
    joinQuestionsAnsweredAt: now
  })
}

/** Which converted spaces go on their parent's menu: the newest open ones, up to the limit. */
function pickMenuProjects (projects) {
  const onMenu = new Set()
  const perParent = {}
  const open = projects
    .filter(p => !p.fulfilled_at)
    .sort((a, b) => new Date(b.updated_at || b.created_at) - new Date(a.updated_at || a.created_at))
  for (const project of open) {
    const count = perParent[project.parent_id] || 0
    if (count >= MENU_LIMIT) continue
    perParent[project.parent_id] = count + 1
    onMenu.add(project.id)
  }
  return onMenu
}

async function createProjectSpace (knex, project, parent, addToMenu, now) {
  const name = ((project.name || '').trim() || 'Project').slice(0, 255)
  const slug = await uniqueSlug(knex, `${parent.slug}-${slugify(name)}`)
  const accessCode = await uniqueAccessCode(knex)

  const children = await knex('posts')
    .where({ parent_post_id: project.id, active: true })
    .select('id', 'type', 'fulfilled_at')
  const otherChildTypes = [...new Set(children.filter(c => c.type !== 'request').map(c => c.type))]
  const commentRow = await knex('comments').where({ post_id: project.id, active: true }).first('id')
  const hasStream = !!commentRow || otherChildTypes.length > 0

  const acceptedPostTypes = ['task']
  if (hasStream) {
    for (const type of ['discussion', ...otherChildTypes]) {
      if (!acceptedPostTypes.includes(type)) acceptedPostTypes.push(type)
    }
  }
  const viewTypes = hasStream ? ['tasks', 'chat', 'all', 'members'] : ['tasks', 'chat', 'members']

  const [inserted] = await knex('groups').insert({
    type: 'space',
    parent_id: parent.id,
    name,
    slug,
    description: project.description,
    icon: 'SquareKanban',
    accepted_post_types: JSON.stringify(acceptedPostTypes),
    visibility: VISIBILITY_PROTECTED,
    accessibility: ACCESSIBILITY_OPEN,
    paywall: false,
    status: 'published',
    settings: JSON.stringify({ [SOURCE_KEY]: String(project.id) }),
    access_code: accessCode,
    calendar_token: crypto.randomUUID(),
    home_route: '/tasks',
    menu_view_count: viewTypes.length,
    num_members: 0,
    num_open_join_requests: 0,
    active: true,
    created_at: project.created_at || now,
    updated_at: now,
    created_by_id: project.user_id
  }).returning('id')
  const spaceId = inserted.id || inserted

  await knex('group_invite_links').insert({
    group_id: spaceId,
    access_code: accessCode,
    grant_access: true,
    granted_roles: JSON.stringify([]),
    num_joined_users: 0,
    created_by_id: project.user_id,
    created_at: now
  })

  // The project's creator and members, as long as they are still in the parent group
  const memberResult = await knex.raw(`
    insert into group_memberships (group_id, user_id, active, settings, created_at, updated_at)
    select ?, u.id, true, ?::jsonb, ?, ?
    from users u
    where u.active = true
      and (
        u.id = ?
        or exists (
          select 1 from posts_users pu
          where pu.post_id = ? and pu.user_id = u.id and pu.active = true and pu.project_role_id is not null
        )
      )
      and exists (
        select 1 from group_memberships gm
        where gm.group_id = ? and gm.user_id = u.id and gm.active = true
      )
  `, [spaceId, membershipSettings(now), now, now, project.user_id, project.id, parent.id])
  await knex('groups').where({ id: spaceId }).update({ num_members: memberResult.rowCount || 0 })

  await knex('group_views').insert(viewTypes.map((type, order) => ({
    group_id: spaceId, type, order, created_at: now, updated_at: now
  })))

  await knex('task_statuses').insert(DEFAULT_COLUMNS.map(column => ({
    ...column, group_id: spaceId, created_at: now, updated_at: now
  })))

  // The space's entry in its parent: on the menu, or off it in More Spaces
  let order = null
  if (addToMenu) {
    const row = await knex('group_views').where({ group_id: parent.id }).max('order as max_order').first()
    order = row && row.max_order != null ? Number(row.max_order) + 1 : 0
  }
  await knex('group_views').insert({
    group_id: parent.id, type: 'space', linked_group_id: spaceId, name, order, created_at: now, updated_at: now
  })

  // Posts made under the project move into the space; requests become its tasks
  const requestIds = children.filter(c => c.type === 'request').map(c => c.id)
  if (requestIds.length > 0) {
    await knex.raw(`
      update posts
      set type = 'task',
          task_category = case when fulfilled_at is not null then 'done' else 'todo' end
      where id = any(?)
    `, [requestIds])
  }
  const spacePostIds = children.map(c => c.id)
  if (hasStream) spacePostIds.push(project.id)
  if (spacePostIds.length > 0) {
    await knex('groups_posts').insert(spacePostIds.map(postId => ({ group_id: spaceId, post_id: postId })))
  }

  await knex('posts').where({ id: project.id }).update({ type: 'discussion' })

  return spaceId
}

exports.up = async function (knex) {
  const now = new Date()

  const { rows: projects } = await knex.raw(`
    select p.id, p.name, p.description, p.user_id, p.created_at, p.updated_at, p.fulfilled_at,
      (
        select case when g.type = 'space' then g.parent_id else g.id end
        from groups_posts gp
        join groups g on g.id = gp.group_id
        where gp.post_id = p.id and g.active = true
        order by gp.id
        limit 1
      ) as parent_id
    from posts p
    where p.type = 'project' and p.active = true and p.user_id is not null
    order by p.id
  `)

  const parentIds = [...new Set(projects.map(p => p.parent_id).filter(Boolean))]
  const parents = {}
  for (let i = 0; i < parentIds.length; i += 1000) {
    const rows = await knex('groups')
      .whereIn('id', parentIds.slice(i, i + 1000))
      .where({ active: true })
      .select('id', 'slug', 'type')
    for (const row of rows) {
      if (row.type !== 'space') parents[row.id] = row
    }
  }

  const convertible = projects.filter(p => p.parent_id && parents[p.parent_id])
  const onMenu = pickMenuProjects(convertible)
  for (const project of convertible) {
    await createProjectSpace(knex, project, parents[project.parent_id], onMenu.has(project.id), now)
  }

  // Recount the menu and More Spaces totals of every group that gained spaces
  await knex.raw(`
    update groups g
    set menu_view_count = (
          select count(*) from group_views gv where gv.group_id = g.id and gv."order" is not null
        ),
        more_spaces_count = (
          select count(*) from groups s
          where s.parent_id = g.id and s.type = 'space' and s.active = true
            and not exists (
              select 1 from group_views gv
              where gv.linked_group_id = s.id and gv.group_id = g.id and gv.type = 'space' and gv."order" is not null
            )
        )
    where g.id in (select parent_id from groups where settings ->> '${SOURCE_KEY}' is not null)
  `)

  // Whatever is still a project (no usable group, or inactive) becomes a plain task
  await knex.raw(`
    update posts
    set type = 'task',
        task_category = case when fulfilled_at is not null then 'done' else 'todo' end
    where type = 'project'
  `)

  await knex.raw("update group_views set type = 'tasks' where type = 'projects'")
  await knex.raw("update group_views set name = 'view-tasks' where type = 'tasks' and name = 'view-projects'")
  await knex.raw(`
    update group_views
    set settings = jsonb_set(settings, '{postTypes}', replace((settings->'postTypes')::text, '"project"', '"task"')::jsonb)
    where jsonb_exists(settings, 'postTypes') and (settings->'postTypes')::text like '%"project"%'
  `)
  await knex.raw("update groups set home_route = '/tasks' where home_route = '/projects'")
  await knex.raw(`
    update groups
    set accepted_post_types = replace(accepted_post_types::text, '"project"', '"task"')::jsonb
    where accepted_post_types::text like '%"project"%'
  `)
  await knex.raw(`
    update saved_searches
    set post_types = array_replace(post_types, 'project', 'task')
    where 'project' = any(post_types)
  `)

  // Default columns for every group that has a task or a Tasks view and no columns yet
  await knex.raw(`
    insert into task_statuses (group_id, name, category, "order")
    select g.group_id, d.name, d.category, d.ord
    from (
      select gp.group_id from groups_posts gp join posts p on p.id = gp.post_id where p.type = 'task'
      union
      select group_id from group_views where type = 'tasks'
    ) g
    cross join (values
      ('To do', 'todo', 0),
      ('In progress', 'active', 1),
      ('Ready for review', 'active', 2),
      ('Complete', 'done', 3)
    ) as d(name, category, ord)
    where not exists (select 1 from task_statuses ts where ts.group_id = g.group_id)
  `)

  // Place each task on each of its groups' boards: finished ones in the first done column,
  // the rest in the first to-do column, oldest first
  await knex.raw(`
    with target as (
      select gp.id as groups_posts_id,
        (
          select ts.id from task_statuses ts
          where ts.group_id = gp.group_id and ts.category = p.task_category
          order by ts."order", ts.id limit 1
        ) as status_id,
        p.created_at
      from groups_posts gp
      join posts p on p.id = gp.post_id
      where p.type = 'task' and gp.task_status_id is null
    ), ranked as (
      select groups_posts_id, status_id,
        row_number() over (partition by status_id order by created_at, groups_posts_id) as rn
      from target
      where status_id is not null
    )
    update groups_posts gp
    set task_status_id = ranked.status_id, task_position = ranked.rn * ${GAP}
    from ranked
    where gp.id = ranked.groups_posts_id
  `)
}

// Deactivates the spaces `up` created and turns the posts back into projects and requests.
// Anything people added to those spaces afterwards (chat, new tasks) loses its space.
// The deactivated spaces keep their slugs, so running `up` again gives the new ones a suffix.
exports.down = async function (knex) {
  const spaces = await knex('groups')
    .whereRaw(`settings ->> '${SOURCE_KEY}' is not null`)
    .select('id', 'parent_id', knex.raw(`settings ->> '${SOURCE_KEY}' as post_id`))
  const spaceIds = spaces.map(s => s.id)
  const projectIds = spaces.map(s => s.post_id)
  const parentIds = [...new Set(spaces.map(s => s.parent_id))]

  for (let i = 0; i < projectIds.length; i += 1000) {
    const ids = projectIds.slice(i, i + 1000)
    await knex.raw(`
      update posts set type = 'request', task_category = null
      where type = 'task' and parent_post_id = any(?)
    `, [ids])
    await knex.raw("update posts set type = 'project' where id = any(?)", [ids])
  }
  for (let i = 0; i < spaceIds.length; i += 1000) {
    const ids = spaceIds.slice(i, i + 1000)
    await knex('groups_posts').whereIn('group_id', ids).del()
    await knex('group_memberships').whereIn('group_id', ids).update({ active: false })
    await knex('group_views').whereIn('linked_group_id', ids).del()
    // Deactivated rather than deleted, the same way deleting a space works. Deleting the
    // rows means checking every table that points at groups, which takes hours at this size.
    await knex.raw(`
      update groups
      set active = false, num_members = 0, settings = settings - '${SOURCE_KEY}'
      where id = any(?)
    `, [ids])
  }
  for (let i = 0; i < parentIds.length; i += 1000) {
    await knex.raw(`
      update groups g
      set menu_view_count = (
            select count(*) from group_views gv where gv.group_id = g.id and gv."order" is not null
          ),
          more_spaces_count = (
            select count(*) from groups s
            where s.parent_id = g.id and s.type = 'space' and s.active = true
              and not exists (
                select 1 from group_views gv
                where gv.linked_group_id = s.id and gv.group_id = g.id and gv.type = 'space' and gv."order" is not null
              )
          )
      where g.id = any(?)
    `, [parentIds.slice(i, i + 1000)])
  }

  await knex.raw("update posts set type = 'project', task_category = null where type = 'task'")
  await knex.raw('update groups_posts set task_status_id = null, task_position = null where task_status_id is not null')
  await knex.raw("update group_views set name = 'view-projects' where type = 'tasks' and name = 'view-tasks'")
  await knex.raw("update group_views set type = 'projects' where type = 'tasks'")
  await knex.raw(`
    update group_views
    set settings = jsonb_set(settings, '{postTypes}', replace((settings->'postTypes')::text, '"task"', '"project"')::jsonb)
    where jsonb_exists(settings, 'postTypes') and (settings->'postTypes')::text like '%"task"%'
  `)
  await knex.raw("update groups set home_route = '/projects' where home_route = '/tasks'")
  await knex.raw(`
    update groups
    set accepted_post_types = replace(accepted_post_types::text, '"task"', '"project"')::jsonb
    where accepted_post_types::text like '%"task"%'
  `)
  await knex.raw(`
    update saved_searches
    set post_types = array_replace(post_types, 'task', 'project')
    where 'task' = any(post_types)
  `)
}
