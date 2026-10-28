const tableName = 'search_index'
const columnName = 'document'
const defaultLang = 'english'

const wv = (column, weight) =>
  `setweight(to_tsvector('${defaultLang}', ${column}), '${weight}')`

// Rebuilds search_index with both of its recent changes: group rows (20261002000000) and people
// indexed only by the skills they have, not the ones they're learning (skills_users.type 0 = has).
// The skills change first shipped as 20260927130000, which is dated earlier and would have replaced
// the view without group rows wherever 20261002000000 had already run. Matches FullTextSearch.createView.
exports.up = async function (knex) {
  await knex.raw(`drop materialized view if exists ${tableName}`)

  await knex.raw(`create materialized view ${tableName} as (
    select
      ('post-' || p.id::text) as row_key,
      p.id as post_id,
      null::bigint as user_id,
      null::bigint as comment_id,
      null::bigint as group_id,
      p.updated_at as sort_ts,
      ${wv('p.name', 'B')} ||
      ${wv("coalesce(p.description, '')", 'C')} ||
      ${wv('u.name', 'D')} as ${columnName}
    from posts p
    join users u on u.id = p.user_id
    where p.active = true and u.active = true
      and p.type not in ('welcome', 'chat_activity')
  ) union (
    select
      ('user-' || u.id::text) as row_key,
      null as post_id,
      u.id as user_id,
      null as comment_id,
      null::bigint as group_id,
      coalesce(
        (
          select max(gm.created_at)
          from group_memberships gm
          where gm.user_id = u.id and gm.active = true
        ),
        u.last_active_at,
        u.updated_at,
        u.created_at
      ) as sort_ts,
      ${wv('u.name', 'A')} ||
      ${wv("coalesce(string_agg(replace(s.name, '-', ' '), ' '), '')", 'C')} ||
      ${wv("coalesce(u.bio, '')", 'C')} as ${columnName}
    from users u
    left join skills_users su on u.id = su.user_id and su.type = 0
    left join skills s on su.skill_id = s.id
    where u.active = true
    group by u.id
  ) union (
    select
      ('comment-' || c.id::text) as row_key,
      null as post_id,
      null as user_id,
      c.id as comment_id,
      null::bigint as group_id,
      c.created_at as sort_ts,
      ${wv('c.text', 'C')} ||
      ${wv('u.name', 'D')} as ${columnName}
    from comments c
    join users u on u.id = c.user_id
    where c.active = true and u.active = true
  ) union (
    select
      ('group-' || g.id::text) as row_key,
      null::bigint as post_id,
      null::bigint as user_id,
      null::bigint as comment_id,
      g.id as group_id,
      coalesce(g.updated_at, g.created_at) as sort_ts,
      ${wv('g.name', 'A')} ||
      ${wv("coalesce(g.description, '')", 'B')} ||
      ${wv("coalesce(g.location, '')", 'C')} as ${columnName}
    from groups g
    where g.active = true
      and (g.type is null or g.type != 'space')
  )`)

  await knex.raw(`create unique index idx_search_index_unique on ${tableName} (row_key)`)
  await knex.raw(`create index idx_fts_search on ${tableName} using gin(${columnName})`)
  await knex.raw(`create index if not exists idx_search_index_post_id on ${tableName} (post_id) where post_id is not null`)
  await knex.raw(`create index if not exists idx_search_index_user_id on ${tableName} (user_id) where user_id is not null`)
  await knex.raw(`create index if not exists idx_search_index_comment_id on ${tableName} (comment_id) where comment_id is not null`)
  await knex.raw(`create index if not exists idx_search_index_group_id on ${tableName} (group_id) where group_id is not null`)
}

// Back to 20261002000000's view (group rows, all skills)
exports.down = async function (knex) {
  await knex.raw(`drop materialized view if exists ${tableName}`)

  await knex.raw(`create materialized view ${tableName} as (
    select
      ('post-' || p.id::text) as row_key,
      p.id as post_id,
      null::bigint as user_id,
      null::bigint as comment_id,
      null::bigint as group_id,
      p.updated_at as sort_ts,
      ${wv('p.name', 'B')} ||
      ${wv("coalesce(p.description, '')", 'C')} ||
      ${wv('u.name', 'D')} as ${columnName}
    from posts p
    join users u on u.id = p.user_id
    where p.active = true and u.active = true
      and p.type not in ('welcome', 'chat_activity')
  ) union (
    select
      ('user-' || u.id::text) as row_key,
      null as post_id,
      u.id as user_id,
      null as comment_id,
      null::bigint as group_id,
      coalesce(
        (
          select max(gm.created_at)
          from group_memberships gm
          where gm.user_id = u.id and gm.active = true
        ),
        u.last_active_at,
        u.updated_at,
        u.created_at
      ) as sort_ts,
      ${wv('u.name', 'A')} ||
      ${wv("coalesce(string_agg(replace(s.name, '-', ' '), ' '), '')", 'C')} ||
      ${wv("coalesce(u.bio, '')", 'C')} as ${columnName}
    from users u
    left join skills_users su on u.id = su.user_id
    left join skills s on su.skill_id = s.id
    where u.active = true
    group by u.id
  ) union (
    select
      ('comment-' || c.id::text) as row_key,
      null as post_id,
      null as user_id,
      c.id as comment_id,
      null::bigint as group_id,
      c.created_at as sort_ts,
      ${wv('c.text', 'C')} ||
      ${wv('u.name', 'D')} as ${columnName}
    from comments c
    join users u on u.id = c.user_id
    where c.active = true and u.active = true
  ) union (
    select
      ('group-' || g.id::text) as row_key,
      null::bigint as post_id,
      null::bigint as user_id,
      null::bigint as comment_id,
      g.id as group_id,
      coalesce(g.updated_at, g.created_at) as sort_ts,
      ${wv('g.name', 'A')} ||
      ${wv("coalesce(g.description, '')", 'B')} ||
      ${wv("coalesce(g.location, '')", 'C')} as ${columnName}
    from groups g
    where g.active = true
      and (g.type is null or g.type != 'space')
  )`)

  await knex.raw(`create unique index idx_search_index_unique on ${tableName} (row_key)`)
  await knex.raw(`create index idx_fts_search on ${tableName} using gin(${columnName})`)
  await knex.raw(`create index if not exists idx_search_index_post_id on ${tableName} (post_id) where post_id is not null`)
  await knex.raw(`create index if not exists idx_search_index_user_id on ${tableName} (user_id) where user_id is not null`)
  await knex.raw(`create index if not exists idx_search_index_comment_id on ${tableName} (comment_id) where comment_id is not null`)
  await knex.raw(`create index if not exists idx_search_index_group_id on ${tableName} (group_id) where group_id is not null`)
}
