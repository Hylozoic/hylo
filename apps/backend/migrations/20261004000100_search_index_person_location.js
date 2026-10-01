/**
 * Adds a person's location and tagline to their search document (weight C, like
 * skills and bio), so searching for a city finds the people who live there.
 *
 * To keep search working during the rebuild, the new index is built as
 * search_index_next while search_index keeps serving queries, then the two are
 * swapped at the end. After that the cron job's concurrent refresh keeps it
 * current, as before. Schedule this for a quiet time: building the view reads
 * every active post, person and comment.
 *
 * Follows 20260927130000_search_index_skills_has_only.js; the post and comment
 * documents are unchanged.
 */

const tableName = 'search_index'
const nextName = 'search_index_next'
const columnName = 'document'
const defaultLang = 'english'

const indexes = [
  { name: 'idx_search_index_unique', sql: (view, name) => `create unique index ${name} on ${view} (row_key)` },
  { name: 'idx_fts_search', sql: (view, name) => `create index ${name} on ${view} using gin(${columnName})` },
  { name: 'idx_search_index_post_id', sql: (view, name) => `create index ${name} on ${view} (post_id) where post_id is not null` },
  { name: 'idx_search_index_user_id', sql: (view, name) => `create index ${name} on ${view} (user_id) where user_id is not null` },
  { name: 'idx_search_index_comment_id', sql: (view, name) => `create index ${name} on ${view} (comment_id) where comment_id is not null` }
]

const wv = (column, weight) =>
  `setweight(to_tsvector('${defaultLang}', ${column}), '${weight}')`

function viewSql (withLocationAndTagline) {
  const personExtras = withLocationAndTagline
    ? ` ||
      ${wv("coalesce(u.location, '')", 'C')} ||
      ${wv("coalesce(u.tagline, '')", 'C')}`
    : ''

  return `(
    select
      ('post-' || p.id::text) as row_key,
      p.id as post_id,
      null::bigint as user_id,
      null::bigint as comment_id,
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
      ${wv("coalesce(u.bio, '')", 'C')}${personExtras} as ${columnName}
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
      c.created_at as sort_ts,
      ${wv('c.text', 'C')} ||
      ${wv('u.name', 'D')} as ${columnName}
    from comments c
    join users u on u.id = c.user_id
    where c.active = true and u.active = true
  )`
}

async function rebuild (knex, withLocationAndTagline) {
  await knex.raw(`drop materialized view if exists ${nextName}`)
  await knex.raw(`create materialized view ${nextName} as ${viewSql(withLocationAndTagline)}`)
  for (const index of indexes) {
    await knex.raw(index.sql(nextName, `${index.name}_next`))
  }

  // Swap: search_index is unavailable only between here and the end of the migration
  await knex.raw(`drop materialized view if exists ${tableName}`)
  await knex.raw(`alter materialized view ${nextName} rename to ${tableName}`)
  for (const index of indexes) {
    await knex.raw(`alter index ${index.name}_next rename to ${index.name}`)
  }
}

exports.up = async function (knex) {
  await rebuild(knex, true)
}

exports.down = async function (knex) {
  await rebuild(knex, false)
}
