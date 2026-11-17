// Turns project posts into tasks and Projects views into Tasks views.
// - posts.type 'project' -> 'task'. Members stay as they are (they are the task's assignees),
//   as do the donation and project management links.
// - Every group with a converted post, or a Tasks view, gets the four default board columns.
// - Each converted post is placed on each of its groups' boards: completed (fulfilled) posts
//   in "Complete", the rest in "To do", oldest first.
// - Menu views, accepted post types, custom view filters and saved searches that named the
//   project type now name the task type.
// Nothing is dropped, so `down` restores the previous types.

const GAP = 1024

exports.up = async function (knex) {
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

  // Place each task on each of its groups' boards
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

exports.down = async function (knex) {
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
